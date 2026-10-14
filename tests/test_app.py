from io import BytesIO
from zipfile import ZipFile
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_frontend_and_local_assets():
    r = client.get('/')
    assert r.status_code == 200
    assert 'Big ambitions.' in r.text
    assert 'cdnjs.cloudflare.com' not in r.text
    assert 'fonts.googleapis.com' not in r.text
    for asset in ('style.css', 'app.js', 'workspace.css', 'workspace.js', 'mark.svg'):
        assert client.get('/' + asset).status_code == 200


def test_directory_and_filters():
    data = client.get('/api/companies?limit=12').json()
    assert data['total'] > 12
    assert len(data['items']) == 12
    city = client.get('/api/cities').json()[0]
    rows = client.get('/api/companies', params={'city': city}).json()['items']
    assert rows and all(c['city'].lower() == city.lower() for c in rows)
    name = data['items'][0]['company_name']
    assert client.get('/api/companies', params={'search': name}).json()['total'] >= 1
    assert client.get('/api/companies?search=zxxyy-nonexistent-998').json()['total'] == 0
    assert client.get('/api/companies?limit=0').status_code == 422
    assert client.get('/api/companies?match=wrong').status_code == 422


def test_specialties_saved_and_stats():
    spec = client.get('/api/specialties').json()[0]['name']
    rows = client.get('/api/companies', params={'specialties': spec, 'match': 'all'}).json()['items']
    assert rows and all(spec.lower() in [s.lower() for s in row['specialties']] for row in rows)
    company = rows[0]
    assert client.get('/api/companies/by-ids', params={'ids': company['id']}).json()['items'][0]['id'] == company['id']
    assert client.get('/api/companies/by-ids?ids=invalid').json() == {'items': []}
    assert client.get('/api/stats').json()['total_companies'] == client.get('/api/companies').json()['total']


def test_upload_validation_without_ai():
    assert client.post('/api/analyze', files={'file': ('bad.exe', b'bad')}).status_code == 415
    assert client.post('/api/analyze', files={'file': ('empty.txt', b'')}).status_code == 400
    assert client.post('/api/analyze', files={'file': ('tiny.txt', b'hello')}).status_code == 422
    assert client.post('/api/companies/999999/cover-letter', json={'full_name':'Test'}).status_code == 404


def test_source_archive_excludes_secrets_and_is_complete():
    r = client.get('/api/download/source')
    assert r.status_code == 200
    assert 'attachment' in r.headers['content-disposition']
    with ZipFile(BytesIO(r.content)) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        for required in ('run.py','main.py','Static/index.html','Static/workspace.css',
                         'utils/config.py','DataBase/morocco_tech_companies_clean.csv','.env.example','README.md'):
            assert 'TechMap/' + required in names
        assert all('/.git/' not in n and '/.venv/' not in n and '__pycache__' not in n for n in names)
        assert 'TechMap/.env' not in names
        assert '"Static"' in archive.read('TechMap/utils/config.py').decode()


def test_ai_failure_is_actionable(monkeypatch):
    from utils.ai_client import AIError
    def unavailable(*args, **kwargs):
        raise AIError(503, 'Configure your AI provider before using this tool.')
    monkeypatch.setattr('main.generate_resume', unavailable)
    r = client.post('/api/resume/generate', json={'full_name': 'Test User'})
    assert r.status_code == 503
    assert 'provider' in r.json()['detail']
