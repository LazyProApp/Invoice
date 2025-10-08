<?php
/**
 * Kick Service - Pure HTTP Request Forwarding
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST method allowed']);
    exit;
}

class KickService {

    private $endpoints = [
        'ezpay' => [
            'test' => 'https://cinv.ezpay.com.tw/Api/invoice_issue',
            'prod' => 'https://inv.ezpay.com.tw/Api/invoice_issue',
            'void_test' => 'https://cinv.ezpay.com.tw/Api/invoice_invalid',
            'void_prod' => 'https://inv.ezpay.com.tw/Api/invoice_invalid'
        ],
        'ecpay' => [
            'test' => 'https://einvoice-stage.ecpay.com.tw/B2CInvoice/Issue',
            'prod' => 'https://einvoice.ecpay.com.tw/B2CInvoice/Issue',
            'void_test' => 'https://einvoice-stage.ecpay.com.tw/B2CInvoice/Invalid',
            'void_prod' => 'https://einvoice.ecpay.com.tw/B2CInvoice/Invalid'
        ],
        'opay' => [
            'test' => 'https://einvoice-stage.opay.tw/B2CInvoice/Issue',
            'prod' => 'https://einvoice.opay.tw/B2CInvoice/Issue',
            'void_test' => 'https://einvoice-stage.opay.tw/B2CInvoice/Invalid',
            'void_prod' => 'https://einvoice.opay.tw/B2CInvoice/Invalid'
        ],
        'smilepay' => [
            'test' => 'https://ssl.smse.com.tw/api_test/SPEinvoice_Storage.asp',
            'prod' => 'https://ssl.smse.com.tw/api/SPEinvoice_Storage.asp',
            'void_test' => 'https://ssl.smse.com.tw/api_test/SPEinvoice_Storage_Modify.asp',
            'void_prod' => 'https://ssl.smse.com.tw/api/SPEinvoice_Storage_Modify.asp'
        ],
        'amego' => [
            'test' => 'https://invoice-api.amego.tw/json/f0401',
            'prod' => 'https://invoice-api.amego.tw/json/f0401',
            'void_test' => 'https://invoice-api.amego.tw/json/f0501',
            'void_prod' => 'https://invoice-api.amego.tw/json/f0501'
        ],
        'opay_customer' => [
            'test' => 'https://einvoice-stage.opay.tw/B2BInvoice/MaintainMerchantCustomerData',
            'prod' => 'https://einvoice.opay.tw/B2BInvoice/MaintainMerchantCustomerData'
        ]
    ];

    public function kick($request) {
        try {
            if (!isset($request['platform']) || !isset($request['data'])) {
                throw new Exception('Missing platform or data field');
            }

            $platform = strtolower($request['platform']);
            $isTestMode = isset($request['test_mode']) ? $request['test_mode'] : true;
            $invoiceType = isset($request['invoice_type']) ? $request['invoice_type'] : 'B2C';
            $action = isset($request['action']) ? $request['action'] : 'create';
            $data = $request['data'];

            $apiUrl = $this->getApiUrl($platform, $isTestMode, $invoiceType, $action);
            if (!$apiUrl) {
                throw new Exception("Unsupported platform: {$platform}");
            }

            $ball = $this->prepareBall($platform, $data);

            $response = $this->httpPost($apiUrl, $ball, $platform);

            return [
                'success' => true,
                'platform' => $platform,
                'test_mode' => $isTestMode,
                'response' => $response
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'platform' => isset($platform) ? $platform : 'unknown'
            ];
        }
    }

    private function convertToB2BUrl($url) {
        return str_replace('/B2CInvoice/', '/B2BInvoice/', $url);
    }

    private function getVoidActionUrl($platform, $env, $invoiceType) {
        $voidKey = 'void_' . $env;
        $url = $this->endpoints[$platform][$voidKey] ?? null;

        if (!$url) {
            return null;
        }

        if ($invoiceType === 'B2B' && in_array($platform, ['ecpay', 'opay'])) {
            return $this->convertToB2BUrl($url);
        }

        return $url;
    }

    private function getCreateActionUrl($platform, $env, $invoiceType) {
        $url = $this->endpoints[$platform][$env] ?? null;

        if (!$url) {
            return null;
        }

        if ($invoiceType === 'B2B' && in_array($platform, ['ecpay', 'opay'])) {
            return $this->convertToB2BUrl($url);
        }

        return $url;
    }

    private function getApiUrl($platform, $isTestMode, $invoiceType = 'B2C', $action = 'create') {
        $env = $isTestMode ? 'test' : 'prod';

        if ($platform === 'opay' && $action === 'maintain_customer') {
            return $this->endpoints['opay_customer'][$env] ?? null;
        }

        if (!isset($this->endpoints[$platform])) {
            return null;
        }

        if ($action === 'void') {
            return $this->getVoidActionUrl($platform, $env, $invoiceType);
        }

        if ($action === 'create') {
            return $this->getCreateActionUrl($platform, $env, $invoiceType);
        }

        return null;
    }

    private function prepareBall($platform, $data) {
        return $data;
    }

    private function httpPost($url, $data, $platform = '') {
        error_log("Kick API Request - URL: " . $url);
        error_log("Kick API Request - Platform: " . $platform);
        error_log("Kick API Request - Data Keys: " . json_encode(array_keys($data)));
        
        $ch = curl_init();
        
        $useJson = in_array($platform, ['ecpay', 'opay']);
        
        if ($useJson) {
            $postData = json_encode($data);
            $headers = [
                'Content-Type: application/json',
                'User-Agent: LazyInvoice-Kick/1.0'
            ];
        } else {
            $postData = http_build_query($data);
            $headers = [
                'Content-Type: application/x-www-form-urlencoded',
                'User-Agent: LazyInvoice-Kick/1.0'
            ];
        }
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => $headers
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || !empty($error)) {
            throw new Exception("HTTP request failed: {$error}");
        }

        if ($httpCode >= 400) {
            error_log("Kick API Error {$httpCode}: " . substr($response, 0, 500));
            throw new Exception("HTTP error {$httpCode}: {$response}");
        }

        error_log("Kick API Success: " . substr($response, 0, 200));

        $decoded = json_decode($response, true);
        return $decoded !== null ? $decoded : $response;
    }
}


try {
    $input = file_get_contents('php://input');
    $requestData = json_decode($input, true);

    if ($requestData === null) {
        throw new Exception('Invalid JSON input');
    }

    $kickService = new KickService();
    $result = $kickService->kick($requestData);

    echo json_encode($result, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>