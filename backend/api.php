<?php
/**
 * ISH Professional Development Hub — backend (ishweb.nl).
 *
 * GET  -> returns the shared, staff-added resources as JSON: {"resources":[...]}
 * POST -> appends one new resource (JSON body) IF the correct access code is sent.
 *
 * The 80 baseline opportunities live in the website's own data/resources.json
 * (version-controlled). This endpoint only holds the extra items staff add, so
 * the file stays tiny and nothing here can break the baseline list.
 *
 * Deploy: put this file + an empty data.json ({"resources":[]}) in a folder on
 * ishweb.nl (e.g. /pd/), then set CONFIG.API_URL in assets/app.js to its URL.
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$FILE = __DIR__ . '/data.json';
$ACCESS_CODE = 'ISHpd2026'; // MUST match the code in assets/app.js. '' = open to all.

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit;
}

if ($method === 'GET') {
    if (is_file($FILE)) { readfile($FILE); }
    else { echo json_encode(array('resources' => array())); }
    exit;
}

if ($method === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    if (!is_array($d)) { http_response_code(400); echo json_encode(array('ok' => false, 'error' => 'Bad request')); exit; }

    if ($ACCESS_CODE !== '' && (!isset($d['token']) || $d['token'] !== $ACCESS_CODE)) {
        http_response_code(403);
        echo json_encode(array('ok' => false, 'error' => 'Not authorised to add a resource.'));
        exit;
    }

    $cut = function ($k, $n) use ($d) { return mb_substr(trim(isset($d[$k]) ? (string)$d[$k] : ''), 0, $n); };
    $title = $cut('title', 300);
    $category = $cut('category', 100);
    if ($title === '' || $category === '') {
        http_response_code(400);
        echo json_encode(array('ok' => false, 'error' => 'Title and category are required.'));
        exit;
    }
    $url = $cut('url', 400);
    if ($url !== '' && !preg_match('#^https?://#i', $url)) { $url = ''; }

    $rec = array(
        'title' => $title, 'category' => $category, 'provider' => $cut('provider', 200),
        'format' => $cut('format', 60), 'audience' => $cut('audience', 80), 'cost' => $cut('cost', 40),
        'description' => $cut('description', 600), 'url' => $url, 'featured' => false,
        'location' => $cut('location', 80), 'date' => $cut('date', 20),
    );

    $fp = fopen($FILE, 'c+');
    if ($fp === false) { http_response_code(500); echo json_encode(array('ok' => false, 'error' => 'Storage error')); exit; }
    if (flock($fp, LOCK_EX)) {
        $cur = stream_get_contents($fp);
        $data = json_decode($cur, true);
        if (!is_array($data) || !isset($data['resources']) || !is_array($data['resources'])) {
            $data = array('resources' => array());
        }
        $data['resources'][] = $rec;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    echo json_encode(array('ok' => true));
    exit;
}

http_response_code(405);
echo json_encode(array('ok' => false, 'error' => 'Method not allowed'));
