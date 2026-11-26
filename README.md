# Nayto / opensource

Private release candidate for the eight-project catalog. The gallery at `/opensource/` uses screenshots from the curated editions. The GitHub links lead to their standalone repositories.

## Run the hosted edition locally

Use Node.js 22.12 or later and Python 3. From the repository root:

```sh
npm --prefix demo ci
npm --prefix demo run build -- --base=./
mkdir -p public/opensource/dashboard
cp -R demo/dist/. public/opensource/dashboard/
python3 -m http.server 18818 --bind 127.0.0.1 --directory public
```

Open http://127.0.0.1:18818/opensource/. The Vercel build runs the same frontend build and serves only the public directory.

## Dashboard demo

The React interface comes from the Marketing Analytics Dashboard edition at commit `91108d14620824b1189b9ada1ff7464fefb23a4f`. The read-only browser demo filters and sorts its 72 fictional posts locally. The benchmark matrices were calculated by the original MongoDB aggregation; dates and preset ranges are relative to that snapshot. Share links point to the same hosted demo. The installation instructions in the gallery open the full application, including its real API and database.

The sample generator and capture tool are in `demo/scripts/`. To refresh the snapshot, point the local showcase service on port 18808 at an unmodified demonstration database and run `python3 demo/scripts/fixtures.py`. The capture verifies sample fields, timestamps, counts and benchmark membership. It serializes generated sample records, not arbitrary database documents. Update the displayed snapshot date when refreshing it.

## Publishing

The preview uses Vercel Authentication. Private repository labels and indexing directives describe the preview state. Before making it public, confirm redistribution rights and code licenses for the individual editions. Keep the existing private archive separate. The main Nayto site can route only `/opensource` and its descendants to this project's production host once it is approved.
