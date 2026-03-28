# Audit Design Consistency

Check for design inconsistencies after UI changes or swarm agent builds.

## Steps

### 1. Check for old color palette (should be 0 results)
```bash
echo "=== Old blue colors (should be 0) ===" && \
grep -rn "bg-blue-\|text-blue-\|border-blue-" app/ components/ --include="*.tsx" | grep -v node_modules | wc -l && \
echo "=== Old gray colors (should be 0) ===" && \
grep -rn "bg-gray-\|text-gray-\|border-gray-" app/ components/ --include="*.tsx" | grep -v node_modules | wc -l
```

### 2. Check for hardcoded hex colors
```bash
grep -rn 'color="#[0-9a-fA-F]' app/ components/ --include="*.tsx" | \
  grep -v "4285F4" | head -20
# 4285F4 is Google's brand color — OK to hardcode
# Everything else should use Colors constants
```

### 3. Check padding consistency
```bash
echo "=== Should use px-4 (not px-5 or px-6 in screen content) ===" && \
grep -rn "px-5\|px-6" app/ --include="*.tsx" | grep -v "sign-in\|node_modules" | head -10
```

### 4. Check bottom padding on tab screens
```bash
echo "=== Tab screens should have pb-24 or paddingBottom: 96 ===" && \
for f in app/\(app\)/\(tabs\)/*.tsx; do
  echo -n "$(basename $f): "
  grep -c "pb-24\|paddingBottom.*96" "$f" 2>/dev/null || echo "0"
done
```

### 5. Check card styling
```bash
echo "=== Cards should have shadow-sm ===" && \
grep -rn "rounded-xl bg-white" app/ components/ --include="*.tsx" | \
  grep -v "shadow-sm" | grep -v node_modules | head -10
```

### 6. Fix any issues found
For each issue, make the correction following the design tokens in CLAUDE.md.
