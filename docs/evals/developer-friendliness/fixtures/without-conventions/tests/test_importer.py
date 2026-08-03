from src.importer import to_minor_units


def test_to_minor_units_whole():
    assert to_minor_units("12") == 1200


def test_to_minor_units_cents():
    assert to_minor_units("12.34") == 1234
