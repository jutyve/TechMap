import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import geocode_companies as tool


class GeocodeTests(unittest.TestCase):
    def test_prepare_lookup_resume_and_apply(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, review, directory, output = (Path(tmp) / name for name in ('source.csv', 'review.csv', 'clean.csv', 'out.csv'))
            one = dict(zip(tool.IDENTITY, ['one', 'Example', 'Rabat']))
            two = dict(zip(tool.IDENTITY, ['two', 'Other', 'Fès']))
            tool.write(source, [*tool.IDENTITY, 'idk'], [{**one, 'idk': '1 Rue Example / 2 Rue Example'}, {**two, 'idk': 'idk'}])
            tool.prepare(source, review)
            fields, rows = tool.read(review)
            self.assertEqual([r['status'] for r in rows], ['pending', 'pending', 'missing_address'])
            self.assertEqual(rows[0]['multiple_addresses'], 'yes')
            response = b'{"results":[{"country_code":"ma","lat":34.02,"lon":-6.83,"city":"Rabat","result_type":"building","rank":{"confidence":0.96}}]}'
            with patch.dict('os.environ', {'GEOAPIFY_API_KEY': 'test-only'}), patch.object(tool, 'urlopen', side_effect=lambda *a, **kw: io.BytesIO(response)) as provider:
                tool.geocode(review, limit=1, delay=1)
                tool.geocode(review, limit=1, delay=1)
                self.assertEqual(provider.call_count, 2)
                self.assertIn('2+Rue+Example', provider.call_args.args[0])
            fields, rows = tool.read(review)
            self.assertEqual(rows[0]['status'], 'needs_review')
            self.assertEqual(rows[0]['approved'], '')
            tool.write(directory, [*tool.IDENTITY], [two, one])
            with self.assertRaisesRegex(ValueError, 'No approved rows'):
                tool.apply(review, directory, output)
            rows[0]['approved'] = 'yes'
            tool.write(review, fields, rows)
            tool.apply(review, directory, output)
            _, merged = tool.read(output)
            self.assertEqual([r['source_url'] for r in merged], ['two', 'one'])
            self.assertEqual([r['coordonates'] for r in merged], ['', '34.0200000, -6.8300000'])
            rows[1]['approved'] = 'yes'
            tool.write(review, fields, rows)
            with self.assertRaisesRegex(ValueError, 'multiple approved'):
                tool.apply(review, directory, output)
