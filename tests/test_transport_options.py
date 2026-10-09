"""Execute the options flow with minimal HA/form API doubles."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE=Path(__file__).resolve().parents[1]/'custom_components/espn_fantasy/config_flow.py'


class FormAPI:
    def async_create_entry(self, **kwargs):
        return {'type':'create_entry', **kwargs}
    def async_show_form(self, **kwargs):
        return {'type':'form', **kwargs}


class TransportOptionsTests(unittest.IsolatedAsyncioTestCase):
    def flow(self, options):
        tree=ast.parse(SOURCE.read_text())
        node=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='ESPNOptionsFlow')
        def optional(key, default):
            return (key, default)
        scope={'config_entries':SimpleNamespace(OptionsFlow=FormAPI),
               'vol':SimpleNamespace(Optional=optional,Schema=lambda value:value),
               'CONF_COMPACT_LEAGUE_DATA':'compact_league_data'}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[node],type_ignores=[])),str(SOURCE),'exec'),scope)
        flow=scope['ESPNOptionsFlow']()
        flow.config_entry=SimpleNamespace(options=options)
        return flow

    async def test_existing_installations_default_to_legacy_format(self):
        result=await self.flow({}).async_step_init()
        self.assertEqual(result['type'],'form')
        self.assertIn(('compact_league_data',False),result['data_schema'])

    async def test_saved_option_is_displayed_and_can_be_disabled(self):
        flow=self.flow({'compact_league_data':True})
        result=await flow.async_step_init()
        self.assertIn(('compact_league_data',True),result['data_schema'])
        result=await flow.async_step_init({'compact_league_data':False})
        self.assertEqual(result['data'],{'compact_league_data':False})
        self.assertEqual(result['type'],'create_entry')
