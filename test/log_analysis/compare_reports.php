<?php

declare(strict_types=1);

/**
 * baseline JSON と after JSON を比較し、差分Markdownを生成する。
 *
 * 使い方:
 * php test/log_analysis/compare_reports.php \
 *   --before=test/log_analysis/baseline_YYYYMMDD_HHMMSS.json \
 *   --after=test/log_analysis/after_YYYYMMDD_HHMMSS.json \
 *   --output=test/log_analysis/comparison_YYYYMMDD_HHMMSS.md \
 *   --min-after-count=200
 */

main($argv);

function main(array $argv): void
{
    $options = parseOptions($argv);
    $before = loadJsonFile($options['before']);
    $after = loadJsonFile($options['after']);

    $report = buildComparisonMarkdown($before, $after, $options['min-after-count']);
    file_put_contents($options['output'], $report);

    fwrite(STDOUT, "Generated: {$options['output']}\n");
    fwrite(STDOUT, "After total events: " . ($after['summary']['totalEvents'] ?? 0) . "\n");
}

function parseOptions(array $argv): array
{
    $options = [
        'before' => '',
        'after' => '',
        'output' => '',
        'min-after-count' => '200',
    ];

    foreach ($argv as $arg) {
        if (!str_starts_with($arg, '--')) {
            continue;
        }
        $parts = explode('=', substr($arg, 2), 2);
        if (count($parts) !== 2) {
            continue;
        }
        [$k, $v] = $parts;
        if (array_key_exists($k, $options)) {
            $options[$k] = $v;
        }
    }

    if ($options['before'] === '' || $options['after'] === '' || $options['output'] === '') {
        fwrite(STDERR, "Required: --before --after --output\n");
        exit(1);
    }

    $options['min-after-count'] = max(1, (int)$options['min-after-count']);
    return $options;
}

function loadJsonFile(string $path): array
{
    if (!is_file($path)) {
        fwrite(STDERR, "File not found: {$path}\n");
        exit(1);
    }

    $raw = file_get_contents($path);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        fwrite(STDERR, "Invalid JSON: {$path}\n");
        exit(1);
    }

    return $data;
}

function buildComparisonMarkdown(array $before, array $after, int $minAfterCount): string
{
    $beforeSummary = $before['summary'] ?? [];
    $afterSummary = $after['summary'] ?? [];

    $beforeTotal = (int)($beforeSummary['totalEvents'] ?? 0);
    $afterTotal = (int)($afterSummary['totalEvents'] ?? 0);
    $afterReady = $afterTotal >= $minAfterCount;

    $beforeTools = is_array($before['byTool'] ?? null) ? $before['byTool'] : [];
    $afterTools = is_array($after['byTool'] ?? null) ? $after['byTool'] : [];
    $beforeModels = is_array($before['byModel'] ?? null) ? $before['byModel'] : [];
    $afterModels = is_array($after['byModel'] ?? null) ? $after['byModel'] : [];

    $toolNames = array_unique(array_merge(array_keys($beforeTools), array_keys($afterTools)));
    sort($toolNames);

    $lines = [];
    $lines[] = '# Tool Execution Comparison Report';
    $lines[] = '';
    $lines[] = '- Generated: ' . date('Y-m-d H:i:s');
    $lines[] = '- Before generatedAt: ' . (string)($before['generatedAt'] ?? '-');
    $lines[] = '- After generatedAt: ' . (string)($after['generatedAt'] ?? '-');
    $lines[] = '- Min after count threshold: ' . $minAfterCount;
    $lines[] = '- After threshold reached: ' . ($afterReady ? 'yes' : 'no');
    $lines[] = '';

    $lines[] = '## Summary KPI';
    $lines[] = '';
    $lines[] = '| Metric | Before | After | Delta |';
    $lines[] = '|---|---:|---:|---:|';
    appendKpiRow($lines, 'Total events', $beforeTotal, $afterTotal, false);
    appendKpiRow($lines, 'Success rate', (float)($beforeSummary['successRate'] ?? 0), (float)($afterSummary['successRate'] ?? 0), true);
    appendKpiRow($lines, 'Failure rate', (float)($beforeSummary['failureRate'] ?? 0), (float)($afterSummary['failureRate'] ?? 0), true);
    appendKpiRow($lines, 'No change rate', (float)($beforeSummary['noChangeRate'] ?? 0), (float)($afterSummary['noChangeRate'] ?? 0), true);
    $lines[] = '';

    $lines[] = '## By Tool (Success/Failure/No change)';
    $lines[] = '';
    $lines[] = '| Tool | Before total | After total | Before success | After success | Delta success(pp) | Before failure | After failure | Delta failure(pp) | Before no_change | After no_change | Delta no_change(pp) |';
    $lines[] = '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';

    foreach ($toolNames as $tool) {
        $b = $beforeTools[$tool] ?? null;
        $a = $afterTools[$tool] ?? null;

        $bTotal = (int)($b['total'] ?? 0);
        $aTotal = (int)($a['total'] ?? 0);
        $bSuccess = (float)($b['successRate'] ?? 0);
        $aSuccess = (float)($a['successRate'] ?? 0);
        $bFailure = (float)($b['failureRate'] ?? 0);
        $aFailure = (float)($a['failureRate'] ?? 0);
        $bNoChange = (float)($b['noChangeRate'] ?? 0);
        $aNoChange = (float)($a['noChangeRate'] ?? 0);

        $lines[] = sprintf(
            '| %s | %d | %d | %s | %s | %s | %s | %s | %s | %s | %s | %s |',
            $tool,
            $bTotal,
            $aTotal,
            pct($bSuccess),
            pct($aSuccess),
            deltaPp($aSuccess - $bSuccess),
            pct($bFailure),
            pct($aFailure),
            deltaPp($aFailure - $bFailure),
            pct($bNoChange),
            pct($aNoChange),
            deltaPp($aNoChange - $bNoChange)
        );
    }
    $lines[] = '';

    $modelNames = array_unique(array_merge(array_keys($beforeModels), array_keys($afterModels)));
    sort($modelNames);

    $lines[] = '## By Model (Success/Failure/No change)';
    $lines[] = '';
    $lines[] = '| Model | Before total | After total | Before success | After success | Delta success(pp) | Before failure | After failure | Delta failure(pp) | Before no_change | After no_change | Delta no_change(pp) |';
    $lines[] = '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
    foreach ($modelNames as $model) {
        $b = $beforeModels[$model] ?? null;
        $a = $afterModels[$model] ?? null;

        $bTotal = (int)($b['total'] ?? 0);
        $aTotal = (int)($a['total'] ?? 0);
        $bSuccess = (float)($b['successRate'] ?? 0);
        $aSuccess = (float)($a['successRate'] ?? 0);
        $bFailure = (float)($b['failureRate'] ?? 0);
        $aFailure = (float)($a['failureRate'] ?? 0);
        $bNoChange = (float)($b['noChangeRate'] ?? 0);
        $aNoChange = (float)($a['noChangeRate'] ?? 0);

        $lines[] = sprintf(
            '| %s | %d | %d | %s | %s | %s | %s | %s | %s | %s | %s | %s |',
            $model,
            $bTotal,
            $aTotal,
            pct($bSuccess),
            pct($aSuccess),
            deltaPp($aSuccess - $bSuccess),
            pct($bFailure),
            pct($aFailure),
            deltaPp($aFailure - $bFailure),
            pct($bNoChange),
            pct($aNoChange),
            deltaPp($aNoChange - $bNoChange)
        );
    }
    $lines[] = '';

    $lines[] = '## Error Categories (After)';
    $lines[] = '';
    $afterErrors = is_array($after['errorCategories'] ?? null) ? $after['errorCategories'] : [];
    if (count($afterErrors) === 0) {
        $lines[] = '- No failure category data.';
    } else {
        $lines[] = '| Category | Count |';
        $lines[] = '|---|---:|';
        foreach ($afterErrors as $category => $count) {
            $lines[] = '| ' . $category . ' | ' . (int)$count . ' |';
        }
    }
    $lines[] = '';

    $lines[] = '## Decision Hint';
    $lines[] = '';
    if (!$afterReady) {
        $lines[] = '- After sample count is below threshold. Treat this report as provisional.';
    } else {
        $lines[] = '- After sample count reached threshold. Use this report for improvement decision.';
    }

    return implode("\n", $lines) . "\n";
}

function appendKpiRow(array &$lines, string $name, float|int $before, float|int $after, bool $asPercent): void
{
    if ($asPercent) {
        $beforeStr = pct((float)$before);
        $afterStr = pct((float)$after);
        $deltaStr = deltaPp((float)$after - (float)$before);
    } else {
        $beforeStr = (string)$before;
        $afterStr = (string)$after;
        $deltaStr = signed((float)$after - (float)$before, 0);
    }

    $lines[] = sprintf('| %s | %s | %s | %s |', $name, $beforeStr, $afterStr, $deltaStr);
}

function pct(float $value): string
{
    return number_format($value * 100, 2) . '%';
}

function deltaPp(float $rateDelta): string
{
    return signed($rateDelta * 100, 2) . 'pp';
}

function signed(float $value, int $decimals): string
{
    $formatted = number_format(abs($value), $decimals, '.', '');
    if ($value > 0) {
        return '+' . $formatted;
    }
    if ($value < 0) {
        return '-' . $formatted;
    }
    return '0';
}
