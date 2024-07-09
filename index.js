const { keccak256 } = require("@ethersproject/solidity");
const ethers = require("ethers");
const { getCreate2Address, defaultAbiCoder } = require("ethers/lib/utils");

function computePoolAddress({
  poolDeployer,
  tokenA,
  tokenB,
  fee,
  poolInitCodeHash,
}) {
  const [token0, token1] =
    tokenA.toLowerCase() < tokenB.toLowerCase()
      ? [tokenA, tokenB]
      : [tokenB, tokenA]; // does safety checks
  return getCreate2Address(
    poolDeployer,
    keccak256(
      ["bytes"],
      [
        defaultAbiCoder.encode(
          ["address", "address", "uint24"],
          [token0, token1, fee]
        ),
      ]
    ),
    poolInitCodeHash
  );
}

const getPoolInfo = async (
  poolDeployer,
  poolInitCodeHash,
  tokenA,
  tokenB,
  poolFee,
  rpc
) => {
  const poolAddress = computePoolAddress({
    poolDeployer,
    tokenA,
    tokenB,
    fee: poolFee,
    poolInitCodeHash,
  });
  const provider = new ethers.providers.JsonRpcBatchProvider(rpc);
  const contract = new ethers.Contract(
    poolAddress,
    require("./abis/v3Pool.json"),
    provider
  );
  const [token0, token1, fee, tickSpacing, liquidity, slot0] =
    await Promise.all([
      contract.token0(),
      contract.token1(),
      contract.fee(),
      contract.tickSpacing(),
      contract.liquidity(),
      contract.slot0(),
    ]);

  return {
    token0,
    token1,
    fee,
    tickSpacing,
    liquidity,
    slot0,
  };
};

const getQuote = async (
  quoterV2,
  poolDeployer,
  poolInitCodeHash,
  tokenIn,
  tokenOut,
  amountIn,
  fee,
  rpc
) => {
  try {
    const poolInfo = await getPoolInfo(
      poolDeployer,
      poolInitCodeHash,
      tokenIn,
      tokenOut,
      fee,
      rpc
    );
    console.log("Pool Info:", poolInfo);
    const provider = new ethers.providers.JsonRpcBatchProvider(rpc);
    const contract = new ethers.Contract(
      quoterV2,
      require("./abis/quoterV2.json"),
      provider
    );

    const res = await contract.callStatic.quoteExactInput(
      ethers.utils.solidityPack(
        ["address", "uint24", "address"],
        [tokenIn, fee, tokenOut]
      ),
      amountIn
    );
    return {
      amountOut: res.amountOut.toString(),
      sqrtPriceX96AfterList: res.sqrtPriceX96AfterList,
      initializedTicksCrossedList: res.initializedTicksCrossedList,
      gasEstimate: res.gasEstimate,
    };
  } catch (e) {
    console.error("Failed to fetch quote", e?.stack);
  }
};

const main = async () => {
  const QuoterV2_IMX = "0x19982BA744E0810DFE26A6cABe3f3cf568DBC602";
  const PoolDeployer_IMX = "0xFe44699408A456CDEdA31a2281A1D33adEBF354D";
  const POOL_INIT_CODE_HASH_IMX =
    "0x8fb82830f8fa2a81d1b5156176e72c8d6b2fc897bc3d2fa77c25ce28f3a911cc";
  const WETH_IMX = "0x7828DE82Bba71cc354aBd176Afea9F97afb59062";
  const USDC_IMX = "0xcBD623D30e679656655A34EbBac91F5e2bdEBb63";

  const QuoterV2_MOVE = "0x591FC1f613B94A87Ae6b1Bc13f386d4D64Df24E2";
  const PoolDeployer_MOVE = "0x775048cC1DFc6a36d125ED21CFeC806EE35FfEb8";
  const POOL_INIT_CODE_HASH_MOVE =
    "0x965fc9e2b83fdb334d9096bef7094a4584dccd9e2ddd24e23eebe1c03603b398";
  const WETH_MOVE = "0x8Bd68700126A0411e2b8D41FcB7020f2058bC9B4";
  const USDC_MOVE = "0xF907Ca454C739ec2EcF50f929D371cf79D86871b";

  // for IMX Testnet
  console.log("=====================================")
  console.log("Fetching quotes for IMX Testnet")
  console.log("=====================================")
  const quote1 = await getQuote(
    QuoterV2_IMX, // QuoterV2
    PoolDeployer_IMX, // PoolDeployer
    POOL_INIT_CODE_HASH_IMX, // POOL_INIT_CODE_HASH
    WETH_IMX, // WETH
    USDC_IMX, // USDC
    ethers.utils.parseUnits("0.00001", 18), // 0.0001 WETH
    3000, // 0.3% fee tier
    "https://rpc.testnet.immutable.com"
  );
  console.log("Quote for IMX Testnet:", quote1);

  // for MOVE Testnet
  console.log("=====================================")
  console.log("Fetching quotes for MOVE Testnet")
  console.log("=====================================")
  const quote2 = await getQuote(
    QuoterV2_MOVE, // QuoterV2
    PoolDeployer_MOVE, // PoolDeployer
    POOL_INIT_CODE_HASH_MOVE, // POOL_INIT_CODE_HASH
    WETH_MOVE, // WETH
    USDC_MOVE, // USDC
    ethers.utils.parseUnits("0.00001", 18), // 0.0001 WETH
    3000, // 0.3% fee tier
    "https://mevm.internal.devnet.m1.movementlabs.xyz"
  );
  console.log("Quote for MOVE Testnet:", quote2);
};

main();
