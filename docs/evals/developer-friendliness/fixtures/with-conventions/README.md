# ledgerpipe

Imports transaction CSVs from partner banks, normalizes them, and uploads
the result to the settlement service.

    python -m src.importer data/incoming.csv
    python -m src.uploader out/normalized.csv

See CONVENTIONS.md before contributing.
