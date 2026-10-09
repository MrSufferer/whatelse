"""Verify recorded real receipts against an independent rational integral."""
import json, pathlib, urllib.request
from fractions import Fraction
ROOT=pathlib.Path(__file__).resolve().parent.parent
TOKEN='0xa16E02E87b7454126E5E10d957A927A7F5B5d2be'
def rpc(method,params):
    req=urllib.request.Request('http://127.0.0.1:8546',json.dumps(dict(jsonrpc='2.0',id=35,method=method,params=params)).encode(),{'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(req))['result']
def call(selector,block):return int(rpc('eth_call',[dict(to=TOKEN,data=selector),block]),16)
def integral(s):
    t=Fraction(s,10**18);return 10**12*t+9000000*t*t
def snapshot(block):
    r=call('0xbefdcf9b',block);l=call('0x8d867177',block);p=call('0xe8e296c0',block);eth=int(rpc('eth_getBalance',[TOKEN,block]),16)
    assert eth==r+l+p
    return dict(reserve=r,launcher=l,platform=p,eth=eth,supply=call('0x18160ddd',block))
checks=[]
for entry in json.loads((ROOT/'browser-results.json').read_text())['results']:
    if 'hash' not in entry:continue
    rec=rpc('eth_getTransactionReceipt',[entry['hash']]);assert rec['status']=='0x1'
    block=rec['blockNumber'];before=snapshot(hex(int(block,16)-1));after=snapshot(block)
    event=next(l for l in rec['logs'] if l['address'].lower()==TOKEN.lower() and len(l['data'])==386)
    vals=[int(event['data'][i:i+64],16) for i in range(2,len(event['data']),64)]
    x,g,l,p,value,s=vals;buy=after['supply']>before['supply'];raw=integral(s)-integral(before['supply']) if buy else integral(before['supply'])-integral(s)
    expected=-(-raw.numerator//raw.denominator) if buy else raw.numerator//raw.denominator
    fee=(expected+99)//100
    assert g==expected and l==fee//2 and p==fee-fee//2
    assert after['supply']==before['supply']+(x if buy else -x)
    assert after['reserve']==before['reserve']+(g if buy else -g)
    assert after['launcher']==before['launcher']+l and after['platform']==before['platform']+p
    if not buy:assert value==g-fee and after['eth']==before['eth']-value
    checks.append(dict(label=entry['label'],hash=entry['hash'],gross=str(g),fee=str(fee),before=before,after=after,verified=True))
(ROOT/'accounting-results.json').write_text(json.dumps(checks,indent=2)+'\n');print(f'{len(checks)} wallet receipts independently verified')
