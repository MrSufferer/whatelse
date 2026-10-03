"""Read Ethereum-side arbitration fees; never transmit a transaction."""
import json
import urllib.request
from pathlib import Path
from rehearse import calldata, words

RPC = 'https://ethereum.publicnode.com'
FOREIGN = '0x54811e1157ccc2be68ce4cc850e5ab3382fe627f'


def rpc(method, params):
    request = urllib.request.Request(RPC, json.dumps(dict(jsonrpc='2.0',id=1,method=method,params=params)).encode(), {'Content-Type':'application/json','User-Agent':'seer-read-only-validation'})
    reply = json.load(urllib.request.urlopen(request,timeout=60))
    if 'error' in reply:
        raise RuntimeError(str(reply['error']))
    return reply['result']


if __name__ == '__main__':
    result = {'rpc':RPC,'foreignProxy':FOREIGN, 'contestedBridgeExecuted':False}
    try:
        assert int(rpc('eth_chainId',[]),16) == 1
        block = rpc('eth_getBlockByNumber',['latest',False])
        result['block'] = block
        tag = block['number']
        def call(address, signature, *args):
            return rpc('eth_call',[{'to':address,'data':calldata(signature,*args)},tag])
        result['getters'] = {sig:call(FOREIGN,sig) for sig in ['arbitrator()','arbitratorExtraData()','homeProxy()','messenger()']}
        arbitrator = '0x'+format(words(result['getters']['arbitrator()'])[0],'040x')
        extra_words = words(result['getters']['arbitratorExtraData()'])
        extra = result['getters']['arbitratorExtraData()'][130:130+extra_words[1]*2]
        result['arbitrationCostWei'] = words(call(arbitrator,'arbitrationCost(bytes)','0x'+extra))[0]
        result['getDisputeFeeWei'] = words(call(FOREIGN,'getDisputeFee(bytes32)','0x'+'00'*32))[0]
        result['completedReadOnly'] = True
    except Exception as error:
        result['error'] = str(error)
    Path('evidence/seer-beta/arbitration.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
