"""The map includes the whole directory without contact or detail payloads."""

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.companies import router
from app.services.data import parse_coordinates


class CompanyMapTests(unittest.TestCase):
    def test_map_contains_every_directory_record(self):
        app = FastAPI()
        app.include_router(router)
        with TestClient(app) as client:
            directory = client.get('/api/companies?limit=1').json()
            response = client.get('/api/companies/map')
            self.assertEqual(response.status_code, 200)
            items = response.json()['items']
            self.assertGreater(len(items), 0)
            self.assertEqual(len(items), directory['total'])
            self.assertEqual(len({item['id'] for item in items}), len(items))
            for item in items:
                self.assertEqual(set(item), {'id', 'company_name', 'city', 'specialties', 'coordinates', 'street_address'})
                self.assertIsInstance(item['specialties'], list)

    def test_coordinates_validation(self):
        self.assertEqual(parse_coordinates('33.5731, -7.5898'), [33.5731, -7.5898])
        for invalid in ('introuvable', '', 'NaN,-7', '91,-7', '33,7', '33,-7,2'):
            self.assertIsNone(parse_coordinates(invalid))
