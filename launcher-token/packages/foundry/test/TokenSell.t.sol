// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import { Test } from "forge-std/Test.sol";
import { LauncherToken } from "../contracts/TokenFactory.sol";

contract TokenSellTest is Test {
    LauncherToken token;

    function setUp() public {
        token = new LauncherToken("Fixture", "FIX", address(1), address(2), address(3));
        vm.deal(address(this), 100 ether);
    }
    receive() external payable { }

    function testSellAtCapReleasesGrossBurnsExactQuantityAndReopensBuy() public {
        token.buy{ value: 10.1 ether }(1_000_000e18, block.timestamp);
        LauncherToken.SellQuote memory q = token.quoteSell(1e18);
        assertEq(q.gross, 18_999_991_000_000);
        assertEq(q.fee, 189_999_910_000);
        assertEq(q.net, 18_809_991_090_000);
        uint256 beforeEth = address(this).balance;
        token.sell(1e18, q.net, block.timestamp);
        assertEq(address(this).balance - beforeEth, q.net);
        assertEq(token.totalSupply(), 999_999e18);
        assertEq(token.balanceOf(address(this)), 999_999e18);
        assertEq(token.curveReserve(), 10 ether - q.gross);
        assertEq(token.launcherFeesEarned(), 0.05 ether + 94_999_955_000);
        assertEq(token.platformFeesEarned(), 0.05 ether + 94_999_955_000);
        assertEq(address(token).balance, token.curveReserve() + token.launcherFeesEarned() + token.platformFeesEarned());
        assertEq(token.quoteBuy(1 ether).tokens, 1e18);
    }

    function testFractionalAndZeroNetFeeBoundary() public {
        token.buy{ value: 10.1 ether }(0, block.timestamp);
        LauncherToken.SellQuote memory q = token.quoteSell(0.25e18);
        assertEq(q.gross, 4_749_999_437_500);
        assertEq(q.launcherFee, 23_749_997_187);
        assertEq(q.platformFee, 23_749_997_188);
        assertEq(q.net, 4_702_499_443_125);
        token.sell(q.tokens, q.net, block.timestamp);
        assertEq(token.balanceOf(address(this)), 999_999.75e18);
        // Adjacent independent literals at cap, not the changed supply.
        LauncherToken other = new LauncherToken("Tiny", "T", address(1), address(2), address(3));
        other.buy{ value: 10.1 ether }(0, block.timestamp);
        q = other.quoteSell(52632);
        assertEq(q.gross, 1);
        assertEq(q.fee, 1);
        assertEq(q.platformFee, 1);
        assertEq(q.net, 0);
        uint256 beforeEth = address(this).balance;
        other.sell(52632, 0, block.timestamp);
        assertEq(address(this).balance, beforeEth);
        assertEq(other.totalSupply(), 1_000_000e18 - 52632);
        assertEq(other.curveReserve(), 10 ether - 1);
    }

    function testFundedFullUnwindKeepsDustAndFeeLiabilities() public {
        token.buy{ value: 2 }(0, block.timestamp);
        token.buy{ value: 2 }(0, block.timestamp);
        assertEq(token.totalSupply(), 1_999_998);
        LauncherToken.SellQuote memory q = token.quoteSell(1_999_998);
        assertEq(q.gross, 1);
        assertEq(q.net, 0);
        token.sell(q.tokens, 0, block.timestamp);
        assertEq(token.totalSupply(), 0);
        assertEq(token.curveReserve(), 1);
        assertEq(token.launcherFeesEarned(), 0);
        assertEq(token.platformFeesEarned(), 3);
        assertEq(address(token).balance, 4);
        assertGt(token.quoteBuy(2).tokens, 0);
    }

    function testZeroGrossStillBurnsOnlyRequestedFraction() public {
        token.buy{ value: 2 }(0, block.timestamp);
        assertEq(token.quoteSell(1).gross, 0);
        token.sell(1, 0, block.timestamp);
        assertEq(token.balanceOf(address(this)), 999_998);
        assertEq(token.curveReserve(), 1);
        assertEq(token.platformFeesEarned(), 1);
    }

    function testRejectedInputsAndSignedLimitsPreserveAccounting() public {
        token.buy{ value: 0.1 ether }(0, block.timestamp);
        uint256 supply = token.totalSupply();
        uint256 reserve = token.curveReserve();
        uint256 eth = address(token).balance;
        LauncherToken.SellQuote memory q = token.quoteSell(1e18);
        vm.expectRevert(LauncherToken.ZeroQuantity.selector);
        token.sell(0, 0, block.timestamp);
        vm.expectRevert(LauncherToken.InsufficientSupply.selector);
        token.quoteSell(supply + 1);
        vm.expectRevert(LauncherToken.MinimumOutputNotMet.selector);
        token.sell(1e18, q.net + 1, block.timestamp);
        vm.warp(1000);
        vm.expectRevert(LauncherToken.DeadlineExpired.selector);
        token.sell(1e18, 0, 999);
        vm.prank(address(4));
        vm.expectRevert();
        token.sell(1e18, 0, block.timestamp);
        assertEq(token.totalSupply(), supply);
        assertEq(token.curveReserve(), reserve);
        assertEq(address(token).balance, eth);
        assertEq(token.balanceOf(address(this)), supply);
    }

    function testCompetingSaleRejectsOldMinimumAndHolderCanRetry() public {
        token.buy{ value: 10.1 ether }(0, block.timestamp);
        token.transfer(address(4), 500_000e18);
        LauncherToken.SellQuote memory old = token.quoteSell(100_000e18);
        vm.prank(address(4));
        token.sell(500_000e18, 0, block.timestamp);
        uint256 supply = token.totalSupply();
        uint256 reserve = token.curveReserve();
        vm.expectRevert(LauncherToken.MinimumOutputNotMet.selector);
        token.sell(100_000e18, old.net * 99 / 100, block.timestamp);
        assertEq(token.totalSupply(), supply);
        assertEq(token.curveReserve(), reserve);
        token.sell(100_000e18, token.quoteSell(100_000e18).net, block.timestamp);
        assertEq(token.totalSupply(), 400_000e18);
    }

    function testRejectedDeliveryRollsBackAndUnrelatedHolderRecovers() public {
        token.buy{ value: 0.1 ether }(0, block.timestamp);
        RejectingSeller receiver = new RejectingSeller();
        token.transfer(address(receiver), 1e18);
        uint256 supply = token.totalSupply();
        uint256 reserve = token.curveReserve();
        uint256 fees = token.platformFeesEarned();
        uint256 eth = address(token).balance;
        vm.expectRevert(LauncherToken.ProceedsFailed.selector);
        receiver.sale(token, 1e18);
        assertEq(token.balanceOf(address(receiver)), 1e18);
        assertEq(token.totalSupply(), supply);
        assertEq(token.curveReserve(), reserve);
        assertEq(token.platformFeesEarned(), fees);
        assertEq(address(token).balance, eth);
        // Receiver need not accept ETH for a zero-output burn.
        receiver.sale(token, 1);
        assertEq(token.balanceOf(address(receiver)), 1e18 - 1);
        token.sell(1e18, 0, block.timestamp);
        assertEq(token.totalSupply(), supply - 1e18 - 1);
    }

    function testProceedsCannotReenterSellOrBuyAndNormalTradeRecovers() public {
        token.buy{ value: 0.1 ether }(0, block.timestamp);
        ReentrantSeller receiver = new ReentrantSeller();
        token.transfer(address(receiver), 2e18);
        receiver.sale(token);
        assertFalse(receiver.reenteredSell());
        assertFalse(receiver.reenteredBuy());
        assertEq(token.balanceOf(address(receiver)), 1e18);
        token.sell(1e18, 0, block.timestamp);
    }

    function testFuzzPartialThenFullUnwindPreservesBacking(uint256 budget, uint256 quantity) public {
        budget = bound(budget, 2, 10.1 ether);
        token.buy{ value: budget }(0, block.timestamp);
        uint256 supply = token.totalSupply();
        quantity = bound(quantity, 1, supply);
        LauncherToken.SellQuote memory q = token.quoteSell(quantity);
        uint256 reserve = token.curveReserve();
        uint256 beforeEth = address(this).balance;
        token.sell(quantity, q.net, block.timestamp);
        assertEq(token.totalSupply(), supply - quantity);
        assertEq(token.curveReserve(), reserve - q.gross);
        assertEq(address(this).balance - beforeEth, q.net);
        assertEq(address(token).balance, token.curveReserve() + token.launcherFeesEarned() + token.platformFeesEarned());
        if (token.totalSupply() != 0) token.sell(token.totalSupply(), 0, block.timestamp);
        assertEq(token.totalSupply(), 0);
        assertEq(address(token).balance, token.curveReserve() + token.launcherFeesEarned() + token.platformFeesEarned());
    }
}

contract RejectingSeller {
    function sale(LauncherToken token, uint256 quantity) external {
        token.sell(quantity, 0, block.timestamp);
    }
}

contract ReentrantSeller {
    LauncherToken private token;
    bool public reenteredSell;
    bool public reenteredBuy;

    function sale(LauncherToken token_) external {
        token = token_;
        token.sell(1e18, 0, block.timestamp);
    }

    receive() external payable {
        (reenteredSell,) = address(token).call(abi.encodeCall(token.sell, (1e18, 0, block.timestamp)));
        (reenteredBuy,) = address(token).call{ value: 2 }(abi.encodeCall(token.buy, (0, block.timestamp)));
    }
}
