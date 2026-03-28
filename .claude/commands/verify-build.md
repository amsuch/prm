# Verify Build

Run after ANY code change to catch errors before committing.

## Steps

1. Export the web bundle:
```bash
pnpm exec expo export --platform web 2>&1 | grep -E "Bundled|failed|Error:"
```

2. If it fails, read the error and fix it. Common issues:
   - Missing imports (new file not imported correctly)
   - Missing packages (need `pnpm add`)
   - Type errors from Supabase casts
   - NativeWind/CSS interop issues (try `--clear` flag)

3. Check for color consistency after UI changes:
```bash
# Should return 0 results after the warm palette migration
grep -rn "bg-gray-\|bg-blue-\|text-gray-\|text-blue-\|border-gray-\|border-blue-" \
  app/ components/ --include="*.tsx" | grep -v node_modules | head -20
```

4. Check for hardcoded hex colors:
```bash
grep -rn 'color="#[0-9a-fA-F]' app/ components/ --include="*.tsx" | \
  grep -v "4285F4\|node_modules" | head -20
# 4285F4 is Google's brand color — that's OK
```

5. Verify git status is clean (no unintended changes):
```bash
git status --short
```

## When to run
- After every swarm agent completes
- Before every git commit
- After installing/updating packages
- After modifying tsconfig, babel, metro, or tailwind config
