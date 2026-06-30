# Demo-Datenbank (generiert)

Datei `rustime-demo.db` wird mit erzeugt:

```bash
cargo run -p seed-database -- --days 3 --output testdata/rustime-demo.db
```

In die App-DB kopieren (App vorher beenden):

```powershell
Copy-Item testdata\rustime-demo.db $env:USERPROFILE\Documents\rustime-data\rustime.db -Force
```

Details: [../docs/TEST-DATENBANK.md](../docs/TEST-DATENBANK.md)
