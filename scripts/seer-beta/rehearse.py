"""Run only against a fresh localhost Anvil Base fork; no production signing."""
import argparse
import json
import subprocess
import time
import urllib.request
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 80
D = Decimal
UNIT = 10**18
COLLATERAL = '0x5875eee11cf8398102fdad704c9e96607675467a'
MARKET_FACTORY = '0x886Ef0A78faBbAE942F1dA1791A8ed02a5aF8BC6'
ROUTER = '0x3124e97ebF4c9592A17d40E54623953Ff3c77a73'
CTF = '0xAb797C4C6022A401c31543E316D3cd04c67a87fC'
REALITY = '0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8'
NPM = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1'
FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD'
QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a'
SWAP = '0x2626664c2603336E57B271c5C0b26F421741e481'
ZERO = '0x' + '00'*20


def calldata(signature, *args):
    return subprocess.check_output(['cast', 'calldata', signature, *map(str, args)], text=True).strip()


def words(encoded):
    return [int(encoded[i:i+64], 16) for i in range(2, len(encoded), 64)]


class Rehearsal:
    def __init__(self, port, output, require_fresh=True, account_index=0):
        self.url = f'http://127.0.0.1:{port}'
        self.output = Path(output)
        self.log = {'transactions': [], 'cases': []}
        self.rpc('anvil_nodeInfo', [])  # Refuse non-Anvil RPCs.
        assert int(self.rpc('eth_chainId', []), 16) == 8453
        block = self.rpc('eth_getBlockByNumber', ['latest', False])
        if require_fresh:
            assert int(block['number'], 16) == 52108145, 'Start a fresh pinned fork'
        self.log['fork'] = {'block': block, 'rpc': self.url}
        self.account = self.rpc('eth_accounts', [])[account_index]

    def save(self):
        self.output.parent.mkdir(parents=True, exist_ok=True)
        self.output.write_text(json.dumps(self.log, indent=2))

    def rpc(self, method, params):
        req = urllib.request.Request(self.url, json.dumps(dict(jsonrpc='2.0', id=1, method=method, params=params)).encode(), {'Content-Type': 'application/json'})
        reply = json.load(urllib.request.urlopen(req, timeout=120))
        if 'error' in reply:
            raise RuntimeError(str(reply['error']))
        return reply['result']

    def call(self, to, signature, *args):
        return self.rpc('eth_call', [{'from': self.account, 'to': to, 'data': calldata(signature, *args)}, 'latest'])

    def tx(self, to, signature, *args, value=0, fails=False):
        encoded = calldata(signature, *args)
        h = self.rpc('eth_sendTransaction', [{'from': self.account, 'to': to, 'data': encoded, 'gas': hex(15000000), 'value': hex(value)}])
        for _ in range(300):
            receipt = self.rpc('eth_getTransactionReceipt', [h])
            if receipt:
                break
            time.sleep(.1)
        else:
            raise TimeoutError(h)
        self.log['transactions'].append({'to': to, 'signature': signature, 'args': list(map(str, args)), 'value': value, 'receipt': receipt, 'expectedFailure': fails})
        self.save()
        assert (receipt['status'] == '0x0') == fails, (signature, receipt)
        print('EXPECTED_REVERT' if fails else 'OK', signature, flush=True)
        return receipt

    def number(self, to, signature, *args):
        return words(self.call(to, signature, *args))[0]

    def balance(self, token, who=None):
        return self.number(token, 'balanceOf(address)', who or self.account)

    def address(self, to, signature, *args):
        return '0x' + format(words(self.call(to, signature, *args))[0], '040x')

    def now(self):
        return int(self.rpc('eth_getBlockByNumber', ['latest', False])['timestamp'], 16)

    def quote(self, token_in, token_out, amount, fee=3000):
        return words(self.call(QUOTER, 'quoteExactInputSingle((address,address,uint256,uint24,uint160))', f'({token_in},{token_out},{amount},{fee},0)'))[0]

    def rejected_call(self, to, signature, *args):
        try:
            result = self.call(to, signature, *args)
        except RuntimeError as error:
            return str(error)
        raise AssertionError((signature, 'unexpected success', result))

    def fund_locally(self):
        # Artificial balance is explicit evidence, never an acquisition claim.
        key = subprocess.check_output(['cast', 'index', 'address', self.account, '2'], text=True).strip()
        self.rpc('anvil_setStorageAt', [COLLATERAL, key, '0x' + format(1000000*UNIT, '064x')])
        assert self.balance(COLLATERAL) == 1000000*UNIT

    def create(self, name):
        count = self.number(MARKET_FACTORY, 'marketCount()')
        opening = self.now() + 3600
        arg = f'("Beta validation {name}",["A","B","C"],"","","",0,{ZERO},"misc","en_US",0,0,1000000000000000,{opening},["A","B","C"])'
        self.tx(MARKET_FACTORY, 'createCategoricalMarket((string,string[],string,string,string,uint256,address,string,string,uint256,uint256,uint256,uint32,string[]))', arg)
        market = self.address(MARKET_FACTORY, 'markets(uint256)', count)
        tokens = [self.address(market, 'wrappedOutcome(uint256)', i) for i in range(4)]
        return market, tokens, opening

    def depth(self, token, pool):
        sqrt = self.number(pool, 'slot0()')
        token0 = self.address(pool, 'token0()')
        ratio = D(sqrt)**2 / D(2**192)
        price = ratio if token0 == token else 1 / ratio
        buy = 10*UNIT
        sell = int(D(10*UNIT)/price)
        bought = self.quote(COLLATERAL, token, buy)
        received = self.quote(token, COLLATERAL, sell)
        # Remove the exact-input fee from the marginal benchmark, then measure
        # average execution impact. Buy uses execution price / marginal price.
        buy_impact = (D(buy)*D('.997') / D(bought) / price - 1)*100
        sell_impact = (1 - D(received) / (D(sell)*D('.997')*price))*100
        return {'marginalPrice': str(price), 'buyInput': buy, 'buyOutput': bought, 'sellInput': sell, 'sellOutput': received, 'buyFee': buy*3//1000, 'sellFee': sell*3//1000, 'buyImpactPercent': str(buy_impact), 'sellImpactPercent': str(sell_impact), 'ready': buy_impact <= 5 and sell_impact <= 5}

    def case(self, name, prices, reserve, expected_ready):
        before = self.balance(COLLATERAL)
        market, tokens, opening = self.create(name)
        backing = int(max(D(reserve)/p for p in prices)*UNIT) + UNIT
        # Creation persists after an unfunded split. Then recovery resumes it.
        self.tx(ROUTER, 'splitPosition(address,address,uint256)', COLLATERAL, market, backing, fails=True)
        assert self.number(market, 'numOutcomes()') == 3  # Getter excludes INVALID.
        self.tx(COLLATERAL, 'approve(address,uint256)', ROUTER, backing)
        self.tx(ROUTER, 'splitPosition(address,address,uint256)', COLLATERAL, market, backing)
        ctf_before = self.balance(COLLATERAL, CTF)
        self.tx(COLLATERAL, 'approve(address,uint256)', NPM, reserve*UNIT*4)
        pools = []
        for token, price in zip(tokens, prices):
            t0, t1 = sorted([token, COLLATERAL], key=lambda a: int(a, 16))
            ratio = price if t0 == token else 1/price
            sqrt = int(ratio.sqrt()*D(2**96))
            self.tx(NPM, 'createAndInitializePoolIfNecessary(address,address,uint24,uint160)', t0, t1, 3000, sqrt)
            pool = self.address(FACTORY, 'getPool(address,address,uint24)', t0, t1, 3000)
            # Reinitialization cannot reset an existing pool's price.
            original = self.call(pool, 'slot0()')
            self.tx(NPM, 'createAndInitializePoolIfNecessary(address,address,uint24,uint160)', t0, t1, 3000, sqrt*2)
            assert original == self.call(pool, 'slot0()')
            outcome = int(D(reserve*UNIT)/price)
            self.tx(token, 'approve(address,uint256)', NPM, outcome)
            a0, a1 = (outcome, reserve*UNIT) if t0 == token else (reserve*UNIT, outcome)
            sig = 'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))'
            arg = f'({t0},{t1},3000,-887220,887220,{a0},{a1},{a0*99//100},{a1*99//100},{self.account},{self.now()+3600})'
            prediction = words(self.call(NPM, sig, arg))
            # A deadline failure leaves the initialized pool available to resume.
            expired = arg.rsplit(',', 1)[0] + f',{self.now()-1})'
            self.tx(NPM, sig, expired, fails=True)
            self.tx(NPM, sig, arg)
            assert self.address(NPM, 'ownerOf(uint256)', prediction[0]) == self.account
            pools.append({'token': token, 'pool': pool, 'tokenId': prediction[0], 'liquidity': prediction[1], 'amount0': prediction[2], 'amount1': prediction[3], 'depth': self.depth(token, pool)})
        case = {'name': name, 'market': market, 'opening': opening, 'tokens': tokens, 'startingPrices': list(map(str, prices)), 'backing': backing, 'collateralSpent': before-self.balance(COLLATERAL), 'pools': pools}
        assert all(p['depth']['ready'] == expected_ready for p in pools), (name, pools)
        case['expectedReady'] = expected_ready
        self.log['cases'].append(case)
        self.save()
        print('CASE', name, 'ready', all(p['depth']['ready'] for p in pools), flush=True)
        # Execute exact quoted swap under a deadline and nonzero minimum output.
        token = tokens[0]
        expected = self.quote(COLLATERAL, token, 10*UNIT)
        self.tx(COLLATERAL, 'approve(address,uint256)', SWAP, 10*UNIT)
        encoded = calldata('exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))', f'({COLLATERAL},{token},3000,{self.account},{10*UNIT},{expected*99//100},0)')
        self.tx(SWAP, 'multicall(uint256,bytes[])', self.now()-1, f'[{encoded}]', fails=True)
        token_before = self.balance(token)
        self.tx(SWAP, 'multicall(uint256,bytes[])', self.now()+300, f'[{encoded}]')
        assert self.balance(token)-token_before == expected
        sell_amount = min(pools[0]['depth']['sellInput'], self.balance(token))
        expected_sell = self.quote(token, COLLATERAL, sell_amount)
        self.tx(token, 'approve(address,uint256)', SWAP, sell_amount)
        encoded_sell = calldata('exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))', f'({token},{COLLATERAL},3000,{self.account},{sell_amount},{expected_sell*99//100},0)')
        collateral_before = self.balance(COLLATERAL)
        self.tx(SWAP, 'multicall(uint256,bytes[])', self.now()+300, f'[{encoded_sell}]')
        assert self.balance(COLLATERAL)-collateral_before == expected_sell
        case['swaps'] = {'buyOutput': expected, 'sellOutput': expected_sell, 'sellInput': sell_amount, 'minimumOutputPercent': 99, 'deadlineSeconds': 300}
        for position in pools:
            # Simulate decrease to set nonzero amount minima at actual prices.
            position_words = words(self.call(NPM, 'positions(uint256)', position['tokenId']))
            liquidity = position_words[7]
            sig = 'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'
            raw = f'({position["tokenId"]},{liquidity},0,0,{self.now()+300})'
            amounts = words(self.call(NPM, sig, raw))
            self.tx(NPM, sig, f'({position["tokenId"]},{liquidity},{amounts[0]*99//100},{amounts[1]*99//100},{self.now()+300})')
            self.tx(NPM, 'collect((uint256,address,uint128,uint128))', f'({position["tokenId"]},{self.account},{2**128-1},{2**128-1})')
            assert self.number(position['pool'], 'liquidity()') == 0
            position['quoteAfterWithdrawal'] = self.rejected_call(QUOTER, 'quoteExactInputSingle((address,address,uint256,uint24,uint160))', f'({COLLATERAL},{position["token"]},{10*UNIT},3000,0)')
        assert self.balance(COLLATERAL, CTF) == ctf_before
        case['ctfBackingUnchangedByWithdrawal'] = True
        case['unansweredRejection'] = self.rejected_call(market, 'resolve()')
        questions = words(self.call(market, 'questionsIds()'))
        question = '0x'+format(questions[2], '064x')
        self.rpc('evm_setNextBlockTimestamp', [opening+1])
        self.rpc('evm_mine', [])
        self.tx(REALITY, 'submitAnswer(bytes32,bytes32,uint256)', question, '0x'+'ff'*32, 0, value=10**15)
        case['preFinalityRejection'] = self.rejected_call(market, 'resolve()')
        self.rpc('evm_increaseTime', [302401])
        self.rpc('evm_mine', [])
        self.tx(market, 'resolve()')
        condition = self.call(market, 'conditionId()')
        payouts = [self.number(CTF, 'payoutNumerators(bytes32,uint256)', condition, i) for i in range(4)]
        assert payouts == [0,0,0,1], payouts
        amounts = [self.balance(t) for t in tokens]
        for t, amount in zip(tokens, amounts):
            self.tx(t, 'approve(address,uint256)', ROUTER, amount)
        prior = self.balance(COLLATERAL)
        self.tx(ROUTER, 'redeemPositions(address,address,uint256[],uint256[])', COLLATERAL, market, '[0,1,2,3]', '['+','.join(map(str, amounts))+']')
        redeemed = self.balance(COLLATERAL)-prior
        assert redeemed == amounts[3]
        assert all(self.balance(t) == 0 for t in tokens)
        case['invalid'] = {'payouts': payouts, 'amounts': amounts, 'redeemedCollateral': redeemed}
        self.save()

    def run(self):
        self.log['ordinaryWallet'] = {'sUSDSBalance': self.balance(COLLATERAL), 'routerAllowance': self.number(COLLATERAL, 'allowance(address,address)', self.account, ROUTER)}
        self.log['collateralGetters'] = {}
        for sig in ['asset()', 'totalAssets()', 'totalSupply()', 'convertToAssets(uint256)']:
            try:
                self.log['collateralGetters'][sig] = self.call(COLLATERAL, sig, *([UNIT] if 'uint256' in sig else []))
            except RuntimeError as error:
                self.log['collateralGetters'][sig] = str(error)
        self.fund_locally()
        root = self.rpc('evm_snapshot', [])
        for name, weights, reserve, expected_ready in [('equal-underfunded', ['.25']*4, 12, False), ('equal-depth', ['.25']*4, 210, True), ('skew-depth', ['.70','.20','.09','.01'], 210, True)]:
            self.case(name, list(map(D, weights)), reserve, expected_ready)
            assert self.rpc('evm_revert', [root])
            root = self.rpc('evm_snapshot', [])
        self.log['completed'] = True
        self.save()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=18546)
    parser.add_argument('--output', default='evidence/seer-beta/fork.json')
    args = parser.parse_args()
    Rehearsal(args.port, args.output).run()
