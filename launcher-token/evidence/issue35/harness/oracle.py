"""Independent exact-rational curve oracle, no contract calls or floating point."""
from fractions import Fraction
import json
UNIT=10**18
CAP=1_000_000*UNIT

def integral(units):
    tokens=Fraction(units,UNIT)
    return 10**12*tokens+9_000_000*tokens*tokens

def ceil(x):return -(-x.numerator//x.denominator)
def quote(s,x,buy=False):
    raw=integral(s+x)-integral(s) if buy else integral(s)-integral(s-x)
    gross=ceil(raw) if buy else raw.numerator//raw.denominator
    fee=ceil(Fraction(gross,100))
    return dict(supply=str(s),quantity=str(x),gross=str(gross),fee=str(fee),launcher=str(fee//2),platform=str(fee-fee//2),net=str(gross-fee),resultSupply=str(s+x if buy else s-x))
def budget(s,b):
    # Affordability search is only used to pick realistic predecessor buy quantities.
    lo,hi=0,CAP-s
    while lo<hi:
        mid=(lo+hi+1)//2
        q=quote(s,mid,True)
        if int(q['gross'])+int(q['fee'])<=b:lo=mid
        else:hi=mid-1
    return lo

vectors={
 'cap_sell_one':quote(CAP,UNIT),
 'cap_sell_quarter':quote(CAP,UNIT//4),
 'cap_sell_100000':quote(CAP,100_000*UNIT),
 'cap_sell_one_base_unit':quote(CAP,1),
 'cap_gross_one_net_zero':quote(CAP,52632),
 'cap_gross_two':quote(CAP,105264),
 'one_token_full_unwind':quote(UNIT,UNIT),
}
# Two actual affordable buys, then a full unwind, demonstrate cumulative dust.
s=0; reserve=0; launcher=0; platform=0; steps=[]
for b in [2,2]:
    x=budget(s,b);q=quote(s,x,True)
    reserve+=int(q['gross']);launcher+=int(q['launcher']);platform+=int(q['platform']);s+=x
    steps.append(dict(budget=str(b),**q))
q=quote(s,s)
reserve-=int(q['gross']);launcher+=int(q['launcher']);platform+=int(q['platform'])
vectors['two_tiny_buys_full_unwind']=dict(buys=steps,sell=q,lockedDust=str(reserve),launcherLiability=str(launcher),platformLiability=str(platform),actualBalance=str(reserve+launcher+platform))
assert vectors['cap_sell_one']['gross']=='18999991000000'
assert vectors['cap_sell_one_base_unit']['gross']=='0'
assert vectors['cap_gross_one_net_zero']['gross']=='1'
assert vectors['cap_gross_one_net_zero']['net']=='0'
assert reserve==1 and launcher==0 and platform==3
print(json.dumps(vectors,indent=2))
