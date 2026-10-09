// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import { Test } from "forge-std/Test.sol";
import { LauncherToken } from "../contracts/TokenFactory.sol";

contract BudgetBuyTest is Test {
    LauncherToken token;

    function setUp() public {
        token = new LauncherToken("Fixture", "FIX", address(1), address(2), address(3));
        vm.deal(address(this), 100 ether);
    }
    receive() external payable { }

    function testBudgetAtCapRefundsAndIsolatesFees() public {
        LauncherToken.BuyQuote memory q = token.quoteBuy(11 ether);
        assertEq(q.tokens, 1_000_000e18);
        assertEq(q.gross, 10 ether);
        assertEq(q.fee, 0.1 ether);
        assertEq(q.launcherFee, 0.05 ether);
        assertEq(q.platformFee, 0.05 ether);
        assertEq(q.refund, 0.9 ether);
        uint256 beforeBalance = address(this).balance;
        token.buy{ value: 11 ether }(q.tokens, block.timestamp + 300);
        assertEq(token.balanceOf(address(this)), q.tokens);
        assertEq(beforeBalance - address(this).balance, 10.1 ether);
        assertEq(token.curveReserve(), 10 ether);
        assertEq(token.launcherFeesEarned(), 0.05 ether);
        assertEq(address(token).balance, 10.1 ether);
    }

    function testSignedLimitsRejectWithoutAccountingChanges() public {
        LauncherToken.BuyQuote memory q = token.quoteBuy(0.01 ether);
        vm.expectRevert(LauncherToken.MinimumOutputNotMet.selector);
        token.buy{ value: 0.01 ether }(q.tokens + 1, block.timestamp + 300);
        vm.warp(1000);
        vm.expectRevert(LauncherToken.DeadlineExpired.selector);
        token.buy{ value: 0.01 ether }(0, 999);
        assertEq(token.totalSupply(), 0);
        assertEq(token.curveReserve(), 0);
    }

    function testIntegralLiteralAndTinyFeeSplit() public {
        (uint256 gross, uint256 fee) = token.buyCost(1e18);
        assertEq(gross, 1_000_009_000_000);
        assertEq(fee, 10_000_090_000);
        LauncherToken.BuyQuote memory q = token.quoteBuy(2);
        assertEq(q.tokens, 999_999);
        assertEq(q.gross, 1);
        assertEq(q.fee, 1);
        assertEq(q.launcherFee, 0);
        assertEq(q.platformFee, 1);
        token.buy{ value: 2 }(q.tokens, block.timestamp);
        assertEq(token.curveReserve(), 1);
        assertEq(token.platformFeesEarned(), 1);
    }

    function testIntegralAtNonzeroSupplyMatchesWorkedLiteral() public {
        token.buy{ value: 1_010_009_090_000 }(1e18, block.timestamp);
        assertEq(token.totalSupply(), 1e18);
        (uint256 gross, uint256 fee) = token.buyCost(1e18);
        assertEq(gross, 1_000_027_000_000);
        assertEq(fee, 10_000_270_000);
        token.buy{ value: 1_010_027_270_000 }(1e18, block.timestamp);
        assertEq(token.totalSupply(), 2e18);
        assertEq(token.curveReserve(), 2_000_036_000_000);
    }

    function testZeroAndCapQuotesCannotExecute() public {
        vm.expectRevert(LauncherToken.ZeroQuantity.selector);
        token.quoteBuy(1);
        token.buy{ value: 10.1 ether }(0, block.timestamp);
        vm.expectRevert(LauncherToken.SupplyCapReached.selector);
        token.quoteBuy(1 ether);
        vm.expectRevert(LauncherToken.SupplyCapReached.selector);
        token.buy{ value: 1 ether }(0, block.timestamp);
    }

    function testFuzzLargestAffordableQuantityAndExecution(uint256 budget) public {
        budget = bound(budget, 2, 11 ether);
        LauncherToken.BuyQuote memory q = token.quoteBuy(budget);
        assertLe(q.gross + q.fee, budget);
        if (q.tokens < token.cap()) {
            (uint256 gross, uint256 fee) = token.buyCost(q.tokens + 1);
            assertGt(gross + fee, budget);
        }
        token.buy{ value: budget }(q.tokens, block.timestamp + 300);
        assertEq(token.totalSupply(), q.tokens);
        assertEq(token.curveReserve(), q.gross);
        assertEq(address(token).balance, q.gross + q.fee);
    }

    function testRejectedRefundRollsBackAndUnrelatedBuyerRecovers() public {
        RejectingBuyer receiver = new RejectingBuyer();
        vm.deal(address(receiver), 11 ether);
        vm.expectRevert(LauncherToken.RefundFailed.selector);
        receiver.purchase(token);
        assertEq(token.totalSupply(), 0);
        assertEq(token.curveReserve(), 0);
        assertEq(token.launcherFeesEarned(), 0);
        token.buy{ value: 0.01 ether }(0, block.timestamp);
        assertGt(token.balanceOf(address(this)), 0);
    }

    function testRefundCannotReenterBuy() public {
        ReentrantBuyer receiver = new ReentrantBuyer();
        vm.deal(address(receiver), 11 ether);
        receiver.purchase(token);
        assertFalse(receiver.reentered());
        assertEq(token.totalSupply(), token.cap());
        assertEq(token.curveReserve(), 10 ether);
    }

    function testOtherBuyerChangesSupplyAndRejectsOldMinimum() public {
        LauncherToken.BuyQuote memory old = token.quoteBuy(0.1 ether);
        vm.deal(address(4), 1 ether);
        vm.prank(address(4));
        token.buy{ value: 1 ether }(0, block.timestamp + 300);
        vm.expectRevert(LauncherToken.MinimumOutputNotMet.selector);
        token.buy{ value: 0.1 ether }(old.tokens * 99 / 100, block.timestamp + 300);
    }

    function testTransferDoesNotChangeReserveAndUnsolicitedEthIsNotAccounted() public {
        token.buy{ value: 0.01 ether }(0, block.timestamp + 300);
        uint256 supply = token.totalSupply();
        uint256 reserve = token.curveReserve();
        token.transfer(address(4), supply / 2);
        assertEq(token.totalSupply(), supply);
        assertEq(token.curveReserve(), reserve);
        vm.deal(address(token), address(token).balance + 1 ether);
        assertEq(token.curveReserve(), reserve);
    }
}

contract RejectingBuyer {
    function purchase(LauncherToken token) external {
        token.buy{ value: 11 ether }(0, block.timestamp + 300);
    }
}

contract ReentrantBuyer {
    LauncherToken private token;
    bool public reentered;

    function purchase(LauncherToken token_) external {
        token = token_;
        token.buy{ value: 11 ether }(0, block.timestamp + 300);
    }

    receive() external payable {
        (reentered,) = address(token).call{ value: 0.1 ether }(abi.encodeCall(token.buy, (0, block.timestamp + 300)));
    }
}
