"""Local oracle challenge/finality and malformed-creation rehearsal."""
import json
from pathlib import Path
from rehearse import Rehearsal, MARKET_FACTORY, REALITY, CTF, ZERO, words

if __name__ == '__main__':
    r = Rehearsal(18546, 'evidence/seer-beta/challenge.json', require_fresh=False)
    r.log = {'transactions': []}
    count = r.number(MARKET_FACTORY, 'marketCount()')
    invalid = f'("Malformed creation",["OnlyOne"],"","","",0,{ZERO},"misc","en_US",0,0,1000000000000000,{r.now()+3600},["OnlyOne"])'
    r.tx(MARKET_FACTORY, 'createCategoricalMarket((string,string[],string,string,string,uint256,address,string,string,uint256,uint256,uint256,uint32,string[]))', invalid, fails=True)
    assert r.number(MARKET_FACTORY, 'marketCount()') == count
    r.log['failedCreationLeavesMarketCountUnchanged'] = True
    market, _, opening = r.create('challenge')
    question = '0x'+format(words(r.call(market,'questionsIds()'))[2], '064x')
    r.rpc('evm_setNextBlockTimestamp', [opening+1]); r.rpc('evm_mine', [])
    r.tx(REALITY,'submitAnswer(bytes32,bytes32,uint256)',question,'0x'+'00'*32,0,value=10**15)
    r.rpc('evm_increaseTime', [302000]); r.rpc('evm_mine', [])
    r.account = r.rpc('eth_accounts', [])[2]
    r.tx(REALITY,'submitAnswer(bytes32,bytes32,uint256)',question,'0x'+'ff'*32,0,value=2*10**15)
    r.rpc('evm_increaseTime', [500]); r.rpc('evm_mine', [])
    r.log['oldAnswerTimeoutDoesNotFinalizeChallengedQuestion'] = r.rejected_call(market,'resolve()')
    r.rpc('evm_increaseTime', [302401]); r.rpc('evm_mine', [])
    r.tx(market,'resolve()')
    condition = r.call(market,'conditionId()')
    payouts = [r.number(CTF,'payoutNumerators(bytes32,uint256)',condition,i) for i in range(4)]
    assert payouts == [0,0,0,1]
    r.log.update(market=market, question=question, finalPayouts=payouts, completed=True, arbitrationBridgeTested=False)
    r.save()
