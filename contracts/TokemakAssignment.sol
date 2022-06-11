//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";
import "./interfaces/IRewards.sol";
import "./interfaces/IManager.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/UniswapV2Library.sol";

// @title Tokemak's UNI LP auto-compound
// @author Suryansh
contract TokemakAssignment is OwnableUpgradeable, IRewards {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Pair public univ2LpTokensPairs;
    IERC20Upgradeable public tokematAsset;
    IERC20Upgradeable public wethAsset;
    // @dev Tokemak's contract dependencies
    IRewards public tokemakRwrdContract;
    IManager public tokemakManager;
    ILiquidityPool public tokemakUniLpPool;
    IUniswapV2Router02 public uniswapV2Router02;
    uint256 public stakes;

    // @dev events to store data points
    event Deposit(address _investor, uint256 _amount);
    event Stake(address _investor, uint256 _amount);
    event Withdraw(address _investor, uint256 _amount);
    event RequestWithdraw(address _investor, uint256 _amount);

    // @dev returns the contract instance with injected dependencies
    // @param _wethAddress Wrapped Eth address
    // @param _tokemakRwrdContractAddress Tokemak rewards controller address
    // @param _tokemakManagerContractAddress Tokemak main manager controller address
    // @param _tokemakUniLpPoolAddress Tokemak uniswap LP pool address
    // @param _uniswapV2Router02Address
    function init(
        address _tokemakUniLpPoolAddress,
        address _tokemakRwrdContractAddress,
        address _tokemakManagerContractAddress,
        address _uniswapV2Router02Address,
        address _wethAddress,
        address _tokeAddress,
        address _uniV2LpTokensPairsAddress
    ) public initializer {
        __Ownable_init();
        wethAsset = IERC20Upgradeable(_wethAddress);
        tokematAsset = IERC20Upgradeable(_tokeAddress);
        univ2LpTokensPairs = IUniswapV2Pair(_uniV2LpTokensPairsAddress);
        tokemakUniLpPool = ILiquidityPool(_tokemakUniLpPoolAddress);
        tokemakRwrdContract = IRewards(_tokemakRwrdContractAddress);
        tokemakManager = IManager(_tokemakManagerContractAddress);
        uniswapV2Router02 = IUniswapV2Router02(_uniswapV2Router02Address);
    }

    // @dev deposit UNI LP tokens into contract
    // @param _amount number of tokens to deposit
    function deposits(uint256 _amount) public {
        require(_amount > 0, "Deposit amount is invalid");
        univ2LpTokensPairs.approve(address(uniswapV2Router02), _amount);
        univ2LpTokensPairs.transferFrom(msg.sender, address(this), _amount);

        if (univ2LpTokensPairs.balanceOf(address(this)) >= _amount) {
            emit Deposit(msg.sender, _amount);
            stakes = _amount;
        } else {
            revert("Deposit failure");
        }
        stake(stakes);
    }

    function stake(uint256 _amount) internal {
        univ2LpTokensPairs.approve(address(uniswapV2Router02), _amount);
        univ2LpTokensPairs.approve(address(tokemakUniLpPool), _amount);
        tokemakUniLpPool.deposit(_amount);
        emit Stake(msg.sender, _amount);
    }

    function rewardsSigner() external override returns (address) {
        return tokemakRwrdContract.rewardsSigner();
    }

    // @notice Get current claimable token rewards amount
    // @return amount to claim in the current cycle
    function getClaimableAmount(Recipient calldata recipient)
        external
        override
        returns (uint256)
    {
        return tokemakRwrdContract.getClaimableAmount(recipient);
    }

    // @notice Auto-compound call to claim and re-stake rewards
    // @dev Function call execute the following steps:
    // @dev 1.- Check for positive amount of toke rewards in current cycle
    // @dev 2.- Claim TOKE rewards
    // @dev 3.- Swap needed amount of total TOKE rewards to form token pair TOKE-ETH
    // @dev 4.- Provide liquidity to UniswapV2 to TOKE-ETH pool & Receive UNIV2 LP Token
    // @dev 5.- Stake UNIV2 LP Token into TOKEMAK Uni LP Token Pool
    // @param v ECDSA signature,
    // @param r ECDSA signature,
    // @param s ECDSA signature,
    function autoCompound(
        Recipient memory recipient,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        uint256 claimableRwrds = this.getClaimableAmount(recipient);
        uint256 tokemakBalance;
        if (claimableRwrds > 0) {
            this.claim(recipient, v, r, s);
            tokemakBalance = tokematAsset.balanceOf(address(this));
            require(tokemakBalance >= claimableRwrds, "Failed");
        }
        _buyWETH(tokemakBalance);

        uint256 wethBalance = wethAsset.balanceOf(address(this));
        (, , uint256 lpAmount) = addLiquidity(
            address(tokematAsset),
            address(wethAsset),
            tokemakBalance,
            wethBalance
        );
        if (lpAmount > 0) stake(lpAmount);
    }

    function _buyWETH(uint256 _amount) internal returns (uint256) {
        (uint256 reserveA, ) = UniswapV2Library.getReserves(
            uniswapV2Router02.factory(),
            address(tokematAsset),
            address(wethAsset)
        );

        uint256 amountToSwap = calculateSwapInAmount(reserveA, _amount);
        address[] memory path = new address[](2);
        path[0] = address(tokematAsset);
        path[1] = address(wethAsset);

        return swapExactTokens(amountToSwap, 0, path);
    }

    //copied
    function calculateSwapInAmount(uint256 reserveIn, uint256 userIn)
        internal
        pure
        returns (uint256)
    {
        return
            (Babylonian.sqrt(
                reserveIn * (userIn * 3988000 + reserveIn * 3988009)
            ) - reserveIn * 1997) / 1994;
    }

    function swapExactTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path
    ) internal returns (uint256) {
        IERC20Upgradeable(tokematAsset).approve(
            address(uniswapV2Router02),
            amountIn
        );
        return
            uniswapV2Router02.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                block.timestamp
            )[path.length - 1];
    }

    // @notice Uniswapv2 function to add liquidity to existing pool
    // @param token0 1st pair asset address
    // @param token1 2nd pair asset address
    // @param amount0 Aount of 1st pair asset to add as liquidity
    // @param amount1 Amount of 2nd pair asset to add as liquidity
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    )
        internal
        returns (
            uint256 out0,
            uint256 out1,
            uint256 lp
        )
    {
        IERC20Upgradeable(token0).approve(address(uniswapV2Router02), amount0);
        IERC20Upgradeable(token1).approve(address(uniswapV2Router02), amount1);
        (out0, out1, lp) = uniswapV2Router02.addLiquidity(
            token0,
            token1,
            amount0,
            amount1,
            0,
            0,
            address(this),
            block.timestamp
        );
    }

    
    function claim(
        Recipient calldata recipient,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        tokemakRwrdContract.claim(recipient, v, r, s);
    }

    function tokeToken() public override returns (IERC20Upgradeable) {
        return tokemakRwrdContract.tokeToken();
    }

    //withdrawal tokemak's uni LP tokens
    function withdraw(uint256 _amount) public {
        (uint256 minCycle, ) = tokemakUniLpPool.requestedWithdrawals(
            msg.sender
        );
        require(
            minCycle > tokemakManager.getCurrentCycleIndex(),
            "Withdrawal unavailable."
        );
        require(_amount <= stakes, "not enough funds");
        stakes -= _amount;
        tokemakUniLpPool.withdraw(_amount);
        emit Withdraw(msg.sender, _amount);
    }
}
