// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import { Test } from "forge-std/Test.sol";
import { TokenFactory, LauncherToken } from "../contracts/TokenFactory.sol";

contract ReviewedLaunchTest is Test {
    TokenFactory factory;
    address launcher = address(0x1234);
    bytes32 proposal = keccak256("fictional-test-launcher-v1");
    bytes32 revision = keccak256("disclosure-v1");

    function setUp() public {
        factory = new TokenFactory(address(this), address(0x5678));
    }

    function approve() internal {
        factory.setLauncherApproval(launcher, true, "fixture");
        factory.reviewProposal(
            proposal,
            launcher,
            "Fictional Test Launcher",
            "FTEST",
            revision,
            launcher,
            true,
            "reviewed fictional fixture"
        );
    }

    function testReviewedLauncherCreatesZeroSupplyRegisteredToken() public {
        approve();
        vm.prank(launcher);
        address deployed = factory.createToken(proposal, "Fictional Test Launcher", "FTEST", revision);
        LauncherToken token = LauncherToken(deployed);
        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(launcher), 0);
        assertEq(factory.tokenAt(0), deployed);
        assertEq(token.launcherRecipient(), launcher);
        assertEq(token.platformRecipient(), address(0x5678));
        assertEq(token.cap(), 1_000_000e18);
    }

    function testUnapprovedAndRevokedCannotCreate() public {
        vm.expectRevert(TokenFactory.UnauthorizedLauncher.selector);
        vm.prank(launcher);
        factory.createToken(proposal, "Fictional Test Launcher", "FTEST", revision);
        approve();
        factory.reviewProposal(
            proposal, launcher, "Fictional Test Launcher", "FTEST", revision, launcher, false, "revoked"
        );
        vm.expectRevert(TokenFactory.InvalidProposal.selector);
        vm.prank(launcher);
        factory.createToken(proposal, "Fictional Test Launcher", "FTEST", revision);
    }

    function testUnauthorizedOperatorCannotApprove() public {
        vm.prank(launcher);
        vm.expectRevert();
        factory.setLauncherApproval(launcher, true, "unauthorized");
    }

    function testTamperingAndOldRevisionRejected() public {
        approve();
        vm.startPrank(launcher);
        vm.expectRevert(TokenFactory.InvalidProposal.selector);
        factory.createToken(proposal, "Changed", "FTEST", revision);
        vm.expectRevert(TokenFactory.InvalidProposal.selector);
        factory.createToken(proposal, "Fictional Test Launcher", "FTEST", keccak256("old"));
        vm.stopPrank();
    }

    function testCreationCannotRepeatOrMintFreeTokens() public {
        approve();
        vm.prank(launcher);
        address deployed = factory.createToken(proposal, "Fictional Test Launcher", "FTEST", revision);
        vm.prank(launcher);
        vm.expectRevert(TokenFactory.InvalidProposal.selector);
        factory.createToken(proposal, "Fictional Test Launcher", "FTEST", revision);
        (bool minted,) = deployed.call(abi.encodeWithSignature("mint(address,uint256)", launcher, 1e18));
        assertFalse(minted);
        assertEq(LauncherToken(deployed).totalSupply(), 0);
    }

    function testFuzzOtherWalletCannotUseApproval(address caller) public {
        vm.assume(caller != launcher);
        approve();
        vm.prank(caller);
        vm.expectRevert(TokenFactory.UnauthorizedLauncher.selector);
        factory.createToken(proposal, "Fictional Test Launcher", "FTEST", revision);
    }

    function testFixtureRejectsETHAndExposesImmutablePreset() public {
        approve();
        vm.prank(launcher);
        LauncherToken token = LauncherToken(factory.createToken(proposal, "Fictional Test Launcher", "FTEST", revision));
        vm.deal(address(this), 1 ether);
        (bool accepted,) = address(token).call{ value: 1 wei }("");
        assertFalse(accepted);
        assertEq(token.START_PRICE_WEI(), 1_000_000_000_000);
        assertEq(token.SLOPE_WEI_PER_TOKEN(), 18_000_000);
        assertEq(token.TRADING_FEE_BPS(), 100);
        assertEq(token.SLIPPAGE_BPS(), 100);
        assertEq(token.QUOTE_LIFETIME(), 300);
        assertEq(token.PRESET(), keccak256("ETH_LINEAR_V1"));
    }
}
