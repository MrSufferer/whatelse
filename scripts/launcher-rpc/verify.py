#!/usr/bin/env python3
"""Read-only RPC probe. Never writes endpoint URLs or provider diagnostics."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'evidence/launcher-token/rpc-verification.json'
WETH = '0x4200000000000000000000000000000000000006'
NETWORKS = {8453: ('Base Mainnet', 'https://mainnet.base.org'),
            84532: ('Base Sepolia', 'https://sepolia.base.org')}


def credentials():
    values = {}
    for line in (ROOT / '.env').read_text().splitlines():
        key, sep, value = line.partition('=')
        if sep and key.strip() in ('BASE_RPC_URL',):
            words = shlex.split(value, comments=True)
            if len(words) != 1:
                raise ValueError('Invalid RPC configuration')
            values[key.strip()] = words[0]
    for key in ('BASE_RPC_URL',):
        if os.environ.get(key):
            values[key] = os.environ[key]
    if not values.get('BASE_RPC_URL'):
        raise ValueError('BASE_RPC_URL is required')
    return values


def rpc(url, method, params):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or any(c in url for c in '\r\n'):
        raise ValueError('RPC requires a valid HTTPS endpoint')
    # URL goes through stdin, never argv/process listings; stderr is private.
    config = 'url = ' + json.dumps(url) + '\n'
    payload = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params})
    result = subprocess.run(
        ['curl', '--config', '-', '--silent', '--show-error', '--fail',
         '--max-time', '25', '--header', 'Content-Type: application/json',
         '--data-binary', payload], input=config, text=True,
        capture_output=True, timeout=30,
    )
    if result.returncode:
        raise RuntimeError(method + ' transport failed; diagnostics suppressed')
    response = json.loads(result.stdout)
    if response.get('id') != 1 or 'error' in response or 'result' not in response:
        raise RuntimeError(method + ' RPC failed; diagnostics suppressed')
    return response['result']


def probe(url, variable, expected=None):
    chain = int(rpc(url, 'eth_chainId', []), 16)
    if chain not in NETWORKS or (expected is not None and chain != expected):
        raise ValueError('RPC chain ID does not match selected network')
    blocks = {}
    for tag in ('latest', 'safe', 'finalized'):
        block = rpc(url, 'eth_getBlockByNumber', [tag, False])
        if not block or not block.get('hash') or not block.get('parentHash'):
            raise ValueError('Missing block data')
        blocks[tag] = {k: block[k] for k in ('number', 'hash', 'parentHash', 'timestamp')}
    if not (int(blocks['finalized']['number'], 16) <= int(blocks['safe']['number'], 16)
            <= int(blocks['latest']['number'], 16)):
        raise ValueError('Inconsistent block tag ordering')
    pinned = blocks['finalized']['number']
    code = rpc(url, 'eth_getCode', [WETH, pinned])
    if not isinstance(code, str) or len(code) <= 2:
        raise ValueError('Contract bytecode missing')
    decimals = rpc(url, 'eth_call', [{'to': WETH, 'data': '0x313ce567'}, pinned])
    if int(decimals, 16) != 18:
        raise ValueError('Unexpected WETH decimals')
    start = hex(max(0, int(pinned, 16) - 9))
    logs = rpc(url, 'eth_getLogs', [{'address': WETH, 'fromBlock': start, 'toBlock': pinned}])
    if not isinstance(logs, list):
        raise ValueError('Invalid log response')
    for log in logs:
        if (log['address'].lower() != WETH.lower() or log.get('removed', False)
                or not int(start, 16) <= int(log['blockNumber'], 16) <= int(pinned, 16)):
            raise ValueError('Log does not match bounded filter')
    if rpc(url, 'eth_getBlockByNumber', [pinned, False])['hash'] != blocks['finalized']['hash']:
        raise ValueError('Pinned block changed during probe')
    return {'network': NETWORKS[chain][0], 'chain_id': chain,
            'configuration': variable, 'blocks': blocks,
            'contract': {'address': WETH, 'bytecode_bytes': (len(code)-2)//2,
                         'method': 'decimals()', 'result': 18, 'block': pinned},
            'historical_logs': {'address': WETH, 'from_block': start,
                                'to_block': pinned, 'block_count': 10, 'count': len(logs)},
            'read_only': True}


def main():
    TARGET.unlink(missing_ok=True)
    values = credentials()
    results = [probe(values['BASE_RPC_URL'], 'BASE_RPC_URL', 84532),
               probe(NETWORKS[8453][1], 'official public RPC', 8453)]
    evidence = {'checked_at': datetime.now(timezone.utc).isoformat(),
                'status': 'passed', 'networks': results,
                'availability': 'Point-in-time reads only; no SLA or load test established.'}
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(evidence, indent=2) + '\n')
    print('Read-only RPC verification passed for both selected networks.')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('RPC verification failed; private diagnostics suppressed. No successful evidence saved.', file=sys.stderr)
        sys.exit(1)
