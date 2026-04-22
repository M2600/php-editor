<?php

declare(strict_types=1);

/**
 * AI_TOOL_EXECUTION ログを集計し、baseline JSON/Markdown を生成する。
 *
 * 使い方:
 * php test/log_analysis/analyze_tool_logs.php \
 *   --log-dir=test/log_analysis/log \
 *   --output-dir=test/log_analysis \
 *   --user-id=dev \
 *   --days=7 \
 *   --end-date=2026-04-22
 */

const SUCCESS_STATUSES = ['success', 'approved'];
const FAILURE_STATUSES = ['error', 'rejected'];
const NO_CHANGE_STATUS = 'no_change';

main($argv);

function main(array $argv): void
{
    $options = parseOptions($argv);
    $logDir = normalizePath($options['log-dir']);
    $outputDir = normalizePath($options['output-dir']);

    if (!is_dir($logDir)) {
        fwrite(STDERR, "log-dir not found: {$logDir}\n");
        exit(1);
    }
    if (!is_dir($outputDir)) {
        fwrite(STDERR, "output-dir not found: {$outputDir}\n");
        exit(1);
    }

    $window = buildWindow($options['days'], $options['end-date']);
    $selectedLogFiles = selectLogFiles($logDir, $window['start'], $window['end']);

    $aggregate = initAggregate();
    foreach ($selectedLogFiles as $logFile) {
        aggregateLogFile($logFile, $options['user-id'], $aggregate);
    }

    finalizeAggregate($aggregate);

    $generatedAt = date('Y-m-d H:i:s');
    $stamp = date('Ymd_His');
    $jsonPath = $outputDir . "/baseline_{$stamp}.json";
    $mdPath = $outputDir . "/baseline_{$stamp}.md";

    $payload = [
        'generatedAt' => $generatedAt,
        'targetUser' => $options['user-id'],
        'window' => [
            'start' => $window['start']->format('Y-m-d'),
            'end' => $window['end']->format('Y-m-d'),
            'days' => $options['days'],
        ],
        'source' => [
            'logDir' => $logDir,
            'selectedLogFiles' => $selectedLogFiles,
        ],
        'summary' => $aggregate['summary'],
        'byTool' => $aggregate['byTool'],
        'byModel' => $aggregate['byModel'],
        'errorCategories' => $aggregate['errorCategories'],
        'readPerformance' => $aggregate['readPerformance'],
        'validation' => $aggregate['validation'],
    ];

    file_put_contents($jsonPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    file_put_contents($mdPath, buildMarkdownReport($payload));

    fwrite(STDOUT, "Generated:\n");
    fwrite(STDOUT, "- {$jsonPath}\n");
    fwrite(STDOUT, "- {$mdPath}\n");
    fwrite(STDOUT, sprintf("Processed files: %d\n", count($selectedLogFiles)));
    fwrite(STDOUT, sprintf("AI_TOOL_EXECUTION (target user): %d\n", $aggregate['summary']['totalEvents']));
}

function parseOptions(array $argv): array
{
    $defaults = [
        'log-dir' => 'test/log_analysis/log',
        'output-dir' => 'test/log_analysis',
        'user-id' => 'dev',
        'days' => '7',
        'end-date' => date('Y-m-d'),
    ];

    $options = $defaults;
    foreach ($argv as $arg) {
        if (!str_starts_with($arg, '--')) {
            continue;
        }
        $parts = explode('=', substr($arg, 2), 2);
        if (count($parts) !== 2) {
            continue;
        }
        $key = $parts[0];
        $value = $parts[1];
        if (array_key_exists($key, $options)) {
            $options[$key] = $value;
        }
    }

    $days = (int)$options['days'];
    if ($days < 1) {
        fwrite(STDERR, "days must be >= 1\n");
        exit(1);
    }
    $options['days'] = $days;

    $endDate = DateTimeImmutable::createFromFormat('Y-m-d', $options['end-date']);
    if (!$endDate || $endDate->format('Y-m-d') !== $options['end-date']) {
        fwrite(STDERR, "end-date must be YYYY-MM-DD\n");
        exit(1);
    }

    return $options;
}

function normalizePath(string $path): string
{
    $real = realpath($path);
    return $real !== false ? $real : $path;
}

function buildWindow(int $days, string $endDate): array
{
    $end = new DateTimeImmutable($endDate . ' 23:59:59');
    $start = $end->sub(new DateInterval('P' . ($days - 1) . 'D'))->setTime(0, 0, 0);

    return ['start' => $start, 'end' => $end];
}

function selectLogFiles(string $logDir, DateTimeImmutable $start, DateTimeImmutable $end): array
{
    $files = glob($logDir . '/php_editor_*.log');
    if ($files === false) {
        return [];
    }

    $selected = [];
    foreach ($files as $file) {
        if (!preg_match('/php_editor_(\d{4}-\d{2}-\d{2})\.log$/', $file, $m)) {
            continue;
        }
        $date = DateTimeImmutable::createFromFormat('Y-m-d', $m[1]);
        if (!$date) {
            continue;
        }
        if ($date >= $start->setTime(0, 0, 0) && $date <= $end->setTime(0, 0, 0)) {
            $selected[] = $file;
        }
    }

    sort($selected);
    return $selected;
}

function initAggregate(): array
{
    return [
        'summary' => [
            'totalEvents' => 0,
            'successCount' => 0,
            'failureCount' => 0,
            'noChangeCount' => 0,
            'otherStatusCount' => 0,
            'successRate' => 0.0,
            'failureRate' => 0.0,
            'noChangeRate' => 0.0,
        ],
        'byTool' => [],
        'byModel' => [],
        'errorCategories' => [],
        'readPerformance' => [
            'count' => 0,
            'avgMs' => null,
            'medianMs' => null,
            'p95Ms' => null,
            'minMs' => null,
            'maxMs' => null,
            '_values' => [],
        ],
        'validation' => [
            'invalidJsonLines' => 0,
            'aiToolExecutionMissingStatus' => 0,
            'statusCoverageOk' => true,
            'classificationTotal' => 0,
            'classificationMatchesTotalEvents' => true,
        ],
    ];
}

function aggregateLogFile(string $logFile, string $targetUser, array &$aggregate): void
{
    $fh = fopen($logFile, 'r');
    if ($fh === false) {
        return;
    }

    while (($line = fgets($fh)) !== false) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }

        $entry = json_decode($line, true);
        if (!is_array($entry)) {
            $aggregate['validation']['invalidJsonLines']++;
            continue;
        }

        $message = $entry['message'] ?? '';
        $userId = (string)($entry['user_id'] ?? '');
        $context = is_array($entry['context'] ?? null) ? $entry['context'] : [];

        if ($message === 'AI_TOOL_EXECUTION' && $userId === $targetUser) {
            consumeToolExecution($context, $aggregate);
        }

        if ($message === 'Performance: getFile completed' && $userId === $targetUser) {
            consumeReadPerformance($context, $aggregate);
        }
    }

    fclose($fh);
}

function consumeToolExecution(array $context, array &$aggregate): void
{
    $tool = (string)($context['tool'] ?? 'unknown');
    $status = isset($context['status']) ? (string)$context['status'] : '';
    $model = trim((string)($context['model'] ?? 'unknown'));
    if ($model === '') {
        $model = 'unknown';
    }

    $aggregate['summary']['totalEvents']++;
    if ($status === '') {
        $aggregate['validation']['aiToolExecutionMissingStatus']++;
        $aggregate['summary']['otherStatusCount']++;
    } elseif (in_array($status, SUCCESS_STATUSES, true)) {
        $aggregate['summary']['successCount']++;
    } elseif (in_array($status, FAILURE_STATUSES, true)) {
        $aggregate['summary']['failureCount']++;
        $category = categorizeError($context);
        $aggregate['errorCategories'][$category] = ($aggregate['errorCategories'][$category] ?? 0) + 1;
    } elseif ($status === NO_CHANGE_STATUS) {
        $aggregate['summary']['noChangeCount']++;
    } else {
        $aggregate['summary']['otherStatusCount']++;
    }

    if (!isset($aggregate['byTool'][$tool])) {
        $aggregate['byTool'][$tool] = [
            'total' => 0,
            'successCount' => 0,
            'failureCount' => 0,
            'noChangeCount' => 0,
            'otherStatusCount' => 0,
            'successRate' => 0.0,
            'failureRate' => 0.0,
            'noChangeRate' => 0.0,
            'approvalTime' => [
                'count' => 0,
                'avgSec' => null,
                'medianSec' => null,
                'p95Sec' => null,
                '_values' => [],
            ],
        ];
    }

    if (!isset($aggregate['byModel'][$model])) {
        $aggregate['byModel'][$model] = [
            'total' => 0,
            'successCount' => 0,
            'failureCount' => 0,
            'noChangeCount' => 0,
            'otherStatusCount' => 0,
            'successRate' => 0.0,
            'failureRate' => 0.0,
            'noChangeRate' => 0.0,
        ];
    }

    $aggregate['byTool'][$tool]['total']++;
    if (in_array($status, SUCCESS_STATUSES, true)) {
        $aggregate['byTool'][$tool]['successCount']++;
    } elseif (in_array($status, FAILURE_STATUSES, true)) {
        $aggregate['byTool'][$tool]['failureCount']++;
    } elseif ($status === NO_CHANGE_STATUS) {
        $aggregate['byTool'][$tool]['noChangeCount']++;
    } else {
        $aggregate['byTool'][$tool]['otherStatusCount']++;
    }

    $approvalTime = $context['approvalTime'] ?? null;
    if (is_numeric($approvalTime)) {
        $aggregate['byTool'][$tool]['approvalTime']['_values'][] = (float)$approvalTime;
    }

    $aggregate['byModel'][$model]['total']++;
    if (in_array($status, SUCCESS_STATUSES, true)) {
        $aggregate['byModel'][$model]['successCount']++;
    } elseif (in_array($status, FAILURE_STATUSES, true)) {
        $aggregate['byModel'][$model]['failureCount']++;
    } elseif ($status === NO_CHANGE_STATUS) {
        $aggregate['byModel'][$model]['noChangeCount']++;
    } else {
        $aggregate['byModel'][$model]['otherStatusCount']++;
    }
}

function consumeReadPerformance(array $context, array &$aggregate): void
{
    $duration = $context['duration_ms'] ?? null;
    if (!is_numeric($duration)) {
        return;
    }
    $aggregate['readPerformance']['_values'][] = (float)$duration;
}

function categorizeError(array $context): string
{
    $result = is_array($context['result'] ?? null) ? $context['result'] : [];
    $errorText = strtolower((string)($result['error'] ?? ''));

    if ($errorText === '') {
        return 'unknown';
    }
    if (str_contains($errorText, 'path') || str_contains($errorText, 'validation')) {
        return 'path_validation';
    }
    if (str_contains($errorText, 'not found') || str_contains($errorText, 'no such file')) {
        return 'not_found';
    }
    if (str_contains($errorText, 'permission') || str_contains($errorText, 'denied')) {
        return 'permission';
    }
    if (str_contains($errorText, 'replace') || str_contains($errorText, 'match') || str_contains($errorText, 'fuzzy')) {
        return 'replace_miss';
    }

    return 'other';
}

function finalizeAggregate(array &$aggregate): void
{
    $summary = &$aggregate['summary'];

    $baseForSuccessFailure = $summary['successCount'] + $summary['failureCount'];
    $summary['successRate'] = safeRate($summary['successCount'], $baseForSuccessFailure);
    $summary['failureRate'] = safeRate($summary['failureCount'], $baseForSuccessFailure);
    $summary['noChangeRate'] = safeRate($summary['noChangeCount'], $summary['totalEvents']);

    foreach ($aggregate['byTool'] as $tool => &$row) {
        $base = $row['successCount'] + $row['failureCount'];
        $row['successRate'] = safeRate($row['successCount'], $base);
        $row['failureRate'] = safeRate($row['failureCount'], $base);
        $row['noChangeRate'] = safeRate($row['noChangeCount'], $row['total']);

        computeDistribution($row['approvalTime'], 'Sec');
    }
    unset($row);

    foreach ($aggregate['byModel'] as $model => &$row) {
        $base = $row['successCount'] + $row['failureCount'];
        $row['successRate'] = safeRate($row['successCount'], $base);
        $row['failureRate'] = safeRate($row['failureCount'], $base);
        $row['noChangeRate'] = safeRate($row['noChangeCount'], $row['total']);
    }
    unset($row);

    computeDistribution($aggregate['readPerformance'], 'Ms');

    ksort($aggregate['byTool']);
    ksort($aggregate['byModel']);
    arsort($aggregate['errorCategories']);

    $classificationTotal = $summary['successCount']
        + $summary['failureCount']
        + $summary['noChangeCount']
        + $summary['otherStatusCount'];
    $aggregate['validation']['classificationTotal'] = $classificationTotal;
    $aggregate['validation']['classificationMatchesTotalEvents'] = ($classificationTotal === $summary['totalEvents']);
    $aggregate['validation']['statusCoverageOk'] = (
        $aggregate['validation']['aiToolExecutionMissingStatus'] === 0
        && $aggregate['validation']['classificationMatchesTotalEvents']
    );
}

function computeDistribution(array &$bucket, string $unitSuffix): void
{
    $keyAvg = 'avg' . $unitSuffix;
    $keyMedian = 'median' . $unitSuffix;
    $keyP95 = 'p95' . $unitSuffix;
    $keyMin = 'min' . $unitSuffix;
    $keyMax = 'max' . $unitSuffix;

    $values = $bucket['_values'];
    sort($values);

    $count = count($values);
    $bucket['count'] = $count;
    if ($count === 0) {
        $bucket[$keyAvg] = null;
        $bucket[$keyMedian] = null;
        $bucket[$keyP95] = null;
        if (array_key_exists($keyMin, $bucket)) {
            $bucket[$keyMin] = null;
            $bucket[$keyMax] = null;
        }
        unset($bucket['_values']);
        return;
    }

    $sum = array_sum($values);
    $bucket[$keyAvg] = round($sum / $count, 4);
    $bucket[$keyMedian] = round(percentile($values, 50), 4);
    $bucket[$keyP95] = round(percentile($values, 95), 4);
    if (array_key_exists($keyMin, $bucket)) {
        $bucket[$keyMin] = round($values[0], 4);
        $bucket[$keyMax] = round($values[$count - 1], 4);
    }

    unset($bucket['_values']);
}

function percentile(array $sortedValues, float $p): float
{
    $n = count($sortedValues);
    if ($n === 1) {
        return (float)$sortedValues[0];
    }

    $rank = ($p / 100) * ($n - 1);
    $low = (int)floor($rank);
    $high = (int)ceil($rank);

    if ($low === $high) {
        return (float)$sortedValues[$low];
    }

    $weight = $rank - $low;
    return (float)$sortedValues[$low] * (1 - $weight) + (float)$sortedValues[$high] * $weight;
}

function safeRate(int $numerator, int $denominator): float
{
    if ($denominator <= 0) {
        return 0.0;
    }
    return round($numerator / $denominator, 4);
}

function buildMarkdownReport(array $payload): string
{
    $summary = $payload['summary'];
    $validation = $payload['validation'];

    $lines = [];
    $lines[] = '# Tool Execution Baseline Report';
    $lines[] = '';
    $lines[] = '- Generated: ' . $payload['generatedAt'];
    $lines[] = '- User: ' . $payload['targetUser'];
    $lines[] = '- Window: ' . $payload['window']['start'] . ' to ' . $payload['window']['end'] . ' (' . $payload['window']['days'] . ' days)';
    $lines[] = '- Source files: ' . count($payload['source']['selectedLogFiles']);
    $lines[] = '';

    $lines[] = '## Summary';
    $lines[] = '';
    $lines[] = '| Metric | Value |';
    $lines[] = '|---|---:|';
    $lines[] = '| Total events | ' . $summary['totalEvents'] . ' |';
    $lines[] = '| Success count | ' . $summary['successCount'] . ' |';
    $lines[] = '| Failure count | ' . $summary['failureCount'] . ' |';
    $lines[] = '| No change count | ' . $summary['noChangeCount'] . ' |';
    $lines[] = '| Success rate (success+approved / (success+approved+error+rejected)) | ' . formatPercent($summary['successRate']) . ' |';
    $lines[] = '| Failure rate (error+rejected / (success+approved+error+rejected)) | ' . formatPercent($summary['failureRate']) . ' |';
    $lines[] = '| No change rate (no_change / total) | ' . formatPercent($summary['noChangeRate']) . ' |';
    $lines[] = '';

    $lines[] = '## By Tool';
    $lines[] = '';
    $lines[] = '| Tool | Total | Success | Failure | No change | Success rate | Failure rate | No change rate | Approval count | Approval avg(s) | Approval median(s) | Approval p95(s) |';
    $lines[] = '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
    foreach ($payload['byTool'] as $tool => $row) {
        $ap = $row['approvalTime'];
        $lines[] = sprintf(
            '| %s | %d | %d | %d | %d | %s | %s | %s | %d | %s | %s | %s |',
            $tool,
            $row['total'],
            $row['successCount'],
            $row['failureCount'],
            $row['noChangeCount'],
            formatPercent($row['successRate']),
            formatPercent($row['failureRate']),
            formatPercent($row['noChangeRate']),
            $ap['count'],
            formatNumber($ap['avgSec']),
            formatNumber($ap['medianSec']),
            formatNumber($ap['p95Sec'])
        );
    }
    $lines[] = '';

    $lines[] = '## By Model';
    $lines[] = '';
    $lines[] = '| Model | Total | Success | Failure | No change | Success rate | Failure rate | No change rate |';
    $lines[] = '|---|---:|---:|---:|---:|---:|---:|---:|';
    foreach ($payload['byModel'] as $model => $row) {
        $lines[] = sprintf(
            '| %s | %d | %d | %d | %d | %s | %s | %s |',
            $model,
            $row['total'],
            $row['successCount'],
            $row['failureCount'],
            $row['noChangeCount'],
            formatPercent($row['successRate']),
            formatPercent($row['failureRate']),
            formatPercent($row['noChangeRate'])
        );
    }
    $lines[] = '';

    $lines[] = '## Error Categories';
    $lines[] = '';
    if (count($payload['errorCategories']) === 0) {
        $lines[] = '- No failure events in target window.';
    } else {
        $lines[] = '| Category | Count |';
        $lines[] = '|---|---:|';
        foreach ($payload['errorCategories'] as $category => $count) {
            $lines[] = '| ' . $category . ' | ' . $count . ' |';
        }
    }
    $lines[] = '';

    $rp = $payload['readPerformance'];
    $lines[] = '## Read Performance';
    $lines[] = '';
    $lines[] = '| Metric | Value |';
    $lines[] = '|---|---:|';
    $lines[] = '| Count | ' . $rp['count'] . ' |';
    $lines[] = '| Avg ms | ' . formatNumber($rp['avgMs']) . ' |';
    $lines[] = '| Median ms | ' . formatNumber($rp['medianMs']) . ' |';
    $lines[] = '| P95 ms | ' . formatNumber($rp['p95Ms']) . ' |';
    $lines[] = '| Min ms | ' . formatNumber($rp['minMs']) . ' |';
    $lines[] = '| Max ms | ' . formatNumber($rp['maxMs']) . ' |';
    $lines[] = '';

    $lines[] = '## Validation';
    $lines[] = '';
    $lines[] = '| Check | Value |';
    $lines[] = '|---|---:|';
    $lines[] = '| invalidJsonLines | ' . $validation['invalidJsonLines'] . ' |';
    $lines[] = '| aiToolExecutionMissingStatus | ' . $validation['aiToolExecutionMissingStatus'] . ' |';
    $lines[] = '| classificationTotal | ' . $validation['classificationTotal'] . ' |';
    $lines[] = '| classificationMatchesTotalEvents | ' . ($validation['classificationMatchesTotalEvents'] ? 'true' : 'false') . ' |';
    $lines[] = '| statusCoverageOk | ' . ($validation['statusCoverageOk'] ? 'true' : 'false') . ' |';
    $lines[] = '';

    return implode("\n", $lines) . "\n";
}

function formatPercent(float $value): string
{
    return number_format($value * 100, 2) . '%';
}

function formatNumber(?float $value): string
{
    if ($value === null) {
        return '-';
    }
    return number_format($value, 4, '.', '');
}
