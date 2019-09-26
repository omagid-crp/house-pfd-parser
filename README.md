This script parses House financial disclosure reports available at http://clerk.house.gov/public_disc/financial-search.aspx. It's a modification of <a href-"https://github.com/PublicI/pfd-parser">this script</a>, created by the Center for Public Integrity, which parses executive branch financial disclosure reports.

It accepts two command line arguments: filePath and outPath. The filePath is the directory containing PDFs for it to parse. The outPath is the directory where it will save CSVs of the parsed data it produces. If no arguments are given, filePath defaults to `{current_directory}/data/input/`, while outPath defaults to `{current_directory}/data/output/`.

