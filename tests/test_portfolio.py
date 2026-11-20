"""Portfolio lifecycle tests (requires httpx in addition to runtime dependencies)."""

import tempfile
import unittest
from pathlib import Path
from typing import get_args
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.portfolio import router
from app.services import accounts, db
from app.services.config import SESSION_COOKIE
from app.services.portfolio import Template


class PortfolioTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        patcher = patch.object(db, 'DB_PATH', str(Path(temp.name) / 'test.db'))
        patcher.start()
        self.addCleanup(patcher.stop)
        db.init_db()
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.owner, self.owner_id = self.account('owner')
        self.other, _ = self.account('other')
        self.data = {'slug': 'samira-dev', 'name': 'Samira Amrani', 'headline': 'Web developer',
                     'github': 'https://github.com/example', 'skills': 'Python, CSS',
                     'certificates': [{'title': 'Accessibility', 'url': 'https://example.org/credential'}]}

    def account(self, name):
        user = accounts.create_user(name, f'{name}@example.org', 'unused')
        with db.connection() as conn:
            conn.execute('UPDATE users SET is_verified = 1 WHERE id = ?', (user['id'],))
        client = TestClient(self.client.app)
        self.addCleanup(client.close)
        client.cookies.set(SESSION_COOKIE, accounts.create_session(user['id']))
        return client, user['id']

    def test_draft_publish_edit_unpublish_and_account_deletion(self):
        api = '/api/portfolio'
        page = '/portfolio/samira-dev'
        self.assertEqual(self.client.put(api, json=self.data).status_code, 401)
        self.assertEqual(self.owner.put(api, json=self.data).status_code, 200)
        self.assertEqual(self.client.get(page).status_code, 404)
        self.assertEqual(self.owner.get(api).json()['name'], self.data['name'])
        self.assertIsNone(self.other.get(api).json())
        payload = {**self.data, 'published': True}
        self.assertEqual(self.owner.put(api, json=payload).status_code, 200)
        response = self.client.get(page)
        self.assertEqual(response.status_code, 200)
        self.assertIn('Samira Amrani', response.text)
        self.assertIn('Accessibility', response.text)
        self.assertIn("default-src 'none'", response.headers['content-security-policy'])
        self.assertEqual(self.other.put(api, json=payload).status_code, 409)
        self.assertEqual(self.other.post(api + '/unpublish').status_code, 200)
        self.assertEqual(self.client.get(page).status_code, 200)
        payload.update(slug='new-name', template='atlas')
        self.assertEqual(self.owner.put(api, json=payload).status_code, 200)
        self.assertEqual(self.client.get(page).status_code, 404)
        self.assertIn('class="atlas"', self.client.get('/portfolio/new-name').text)
        self.assertEqual(self.owner.post(api + '/unpublish').status_code, 200)
        self.assertEqual(self.client.get('/portfolio/new-name').status_code, 404)
        self.assertEqual(self.owner.get(api).json()['name'], self.data['name'])
        self.owner.put(api, json=payload)
        accounts.delete_user(self.owner_id)
        self.assertEqual(self.client.get('/portfolio/new-name').status_code, 404)

    def test_templates_and_validation(self):
        for template in get_args(Template):
            with self.subTest(template=template):
                response = self.client.post('/api/portfolio/preview', json={
                    'template': template, 'name': '<script>alert(1)</script>',
                })
                self.assertEqual(response.status_code, 200)
                self.assertIn(f'<body class="{template}">', response.text)
                self.assertIn('&lt;script&gt;', response.text)
                self.assertNotIn('<script>', response.text)
        self.assertEqual(self.client.post('/api/portfolio/preview', json={'github': 'javascript:alert(1)'}).status_code, 422)
        self.assertEqual(self.owner.put('/api/portfolio', json={**self.data, 'slug': '../invalid'}).status_code, 422)
        self.assertEqual(self.owner.put('/api/portfolio', json={**self.data, 'published': True, 'name': ' '}).status_code, 422)
        self.assertEqual(self.owner.put('/api/portfolio', json=self.data,
                                        headers={'Origin': 'https://other.example'}).status_code, 403)


if __name__ == '__main__':
    unittest.main()
