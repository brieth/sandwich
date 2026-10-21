#!/bin/sh
# Typechecks one figure file and what it imports, with the project's settings,
# so a check does not trip on another file that is mid-edit.
#   sh scripts/figures/tsc-one.sh src/lib/figures/<group>.ts
cd "$(dirname "$0")/../.." && exec npx tsc --noEmit --target ES2020 --module ESNext --moduleResolution bundler \
  --lib ES2020,DOM,DOM.Iterable --strict --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch \
  --skipLibCheck --isolatedModules --allowImportingTsExtensions "$@"
