"""Acquire sUSDS on the local fork from artificial USDC, never real funds."""
import json
import subprocess
from pathlib import Path
from rehearse import Rehearsal, COLLATERAL, UNIT

PSM = '0x1601843c5E9bC251A3272907010AFa41Fa18347E'
USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

if __name__ == '__main__':
    r = Rehearsal(18546, 'evidence/seer-beta/acquisition.json', require_fresh=False, account_index=3)
    r.log = {'transactions': [], 'account': r.account, 'sUSDSBefore': r.balance(COLLATERAL), 'USDCBefore': r.balance(USDC), 'psmAllowanceBefore': r.number(USDC, 'allowance(address,address)', r.account, PSM)}
    assert r.log['sUSDSBefore'] == 0
    amount = 100*10**6
    # Find USDC's mapping on localhost, reverting every wrong storage probe.
    for slot in range(30):
        key = subprocess.check_output(['cast','index','address',r.account,str(slot)], text=True).strip()
        previous = r.rpc('eth_getStorageAt', [USDC,key,'latest'])
        r.rpc('anvil_setStorageAt', [USDC,key,'0x'+format(amount,'064x')])
        if r.balance(USDC) == amount:
            break
        r.rpc('anvil_setStorageAt', [USDC,key,previous])
    else:
        raise AssertionError('Could not locate local USDC balance mapping')
    r.log['artificialUSDCFunding'] = {'slot': slot, 'amount': amount}
    quote = r.number(PSM, 'previewSwapExactIn(address,address,uint256)', USDC,COLLATERAL,amount)
    sig = 'swapExactIn(address,address,uint256,uint256,address,uint256)'
    r.tx(PSM,sig,USDC,COLLATERAL,amount,quote*99//100,r.account,0,fails=True)
    r.tx(USDC,'approve(address,uint256)',PSM,amount)
    r.tx(PSM,sig,USDC,COLLATERAL,amount,quote*99//100,r.account,0)
    received = r.balance(COLLATERAL)
    assert received >= quote*99//100
    r.log.update(quotedSUSDS=quote, receivedSUSDS=received, USDCSpent=amount-r.balance(USDC), sUSDSInventory=r.balance(COLLATERAL,PSM))
    reverse = r.number(PSM,'previewSwapExactIn(address,address,uint256)',COLLATERAL,USDC,received)
    r.tx(COLLATERAL,'approve(address,uint256)',PSM,received)
    r.tx(PSM,sig,COLLATERAL,USDC,received,reverse*99//100,r.account,0)
    assert r.balance(USDC) >= reverse*99//100
    r.log.update(reverseUSDCQuote=reverse, reverseUSDCReceived=r.balance(USDC), completed=True)
    r.save()
    print(json.dumps({k:v for k,v in r.log.items() if k!='transactions'},indent=2))
