"""Read-only source correspondence, SDK and collateral inspection."""
import concurrent.futures
import hashlib
import json
import urllib.request
from pathlib import Path
from rehearse import Rehearsal, COLLATERAL, REALITY, UNIT

COMMIT = '60423441a71dd4eead5a026a4cff93fbd4c6f4f3'
BASE = f'https://raw.githubusercontent.com/seer-pm/demo/{COMMIT}/'
FILES = [f'contracts/deployments/base/{name}.json' for name in ['MarketFactory','Market','Router','RealityProxy','Reality','ConditionalTokens','Wrapped1155Factory','RealitioHomeArbitrationProxy','CollateralToken']]
FILES += ['contracts/deployments/ethereum/RealitioForeignProxyBase.json','packages/seer-pm-sdk/src/quote.ts','packages/seer-pm-sdk/src/quote-utils.ts','packages/seer-pm-sdk/src/psm3-composite-quote.ts','web/src/hooks/useArbitrationCost.ts','packages/seer-pm-sdk/src/psm3.ts','packages/seer-pm-sdk/src/psm3-abi.ts','packages/seer-pm-sdk/src/amm-trade.ts']


def fetch(path):
    request = urllib.request.Request(BASE+path, headers={'User-Agent': 'seer-read-only-validation'})
    return path, urllib.request.urlopen(request, timeout=90).read()


if __name__ == '__main__':
    reader = Rehearsal(18546, 'evidence/seer-beta/inspection.json', require_fresh=False)
    result = {'upstreamCommit': COMMIT, 'artifacts': [], 'sources': []}
    destination = Path('/tmp/seer-beta-sources')
    destination.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for path, raw in pool.map(fetch, FILES):
            (destination / Path(path).name).write_bytes(raw)
            item = {'path': path, 'url': BASE+path, 'sha256': hashlib.sha256(raw).hexdigest()}
            if path.endswith('.json'):
                artifact = json.loads(raw)
                item.update(address=artifact['address'], deploymentTransaction=artifact.get('transactionHash'), solcInputHash=artifact.get('solcInputHash'))
                if '/base/' in path:
                    code = reader.rpc('eth_getCode', [artifact['address'], '0x31b1b71'])
                    expected = artifact.get('deployedBytecode', '')
                    item.update(runtimeBytes=(len(code)-2)//2, runtimeSha256=hashlib.sha256(bytes.fromhex(code[2:])).hexdigest(), exactRuntimeMatch=code.lower()==expected.lower(), artifactRuntimeBytes=(len(expected)-2)//2 if expected else None)
                    if expected:
                        patched = bytearray.fromhex(expected[2:])
                        actual = bytes.fromhex(code[2:])
                        allowed = {int(arg, 16) if isinstance(arg, str) and arg.startswith('0x') else arg for arg in artifact.get('args', [])}
                        patches = []
                        offset = 0
                        while offset < len(patched):
                            op = patched[offset]
                            length = op-0x5f if 0x60 <= op <= 0x7f else 0
                            start = offset+1
                            if length == 32 and patched[start:start+32] == bytes(32) and len(actual[start:start+32]) == 32:
                                value = int.from_bytes(actual[start:start+32], 'big')
                                if value in allowed:
                                    patched[start:start+32] = actual[start:start+32]
                                    patches.append({'offset': start, 'value': str(value)})
                            offset += 1+length
                        item['constructorWordPatches'] = patches
                        item['constructorWordPatchedMatch'] = bytes(patched) == actual
                    # An exact artifact match is provenance evidence, not a
                    # reproducible compiler rebuild or independent audit.
                result['artifacts'].append(item)
            else:
                result['sources'].append(item)
    result['homeGetters'] = {}
    home = next(a['address'] for a in result['artifacts'] if a['path'].endswith('/RealitioHomeArbitrationProxy.json'))
    for sig in ['foreignProxy()', 'foreignChainId()', 'realitio()', 'amb()', 'owner()', 'messenger()']:
        try:
            result['homeGetters'][sig] = reader.call(home, sig)
        except RuntimeError as error:
            result['homeGetters'][sig] = str(error)
    result['questionFee'] = reader.number(REALITY, 'arbitrator_question_fees(address)', home)
    result['collateral'] = {}
    for sig, args in [('asset()', []), ('convertToAssets(uint256)', [UNIT]), ('previewDeposit(uint256)', [UNIT]), ('symbol()', []), ('decimals()', [])]:
        try:
            result['collateral'][sig] = reader.call(COLLATERAL, sig, *args)
        except RuntimeError as error:
            result['collateral'][sig] = str(error)
    Path('evidence/seer-beta/inspection.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
