import express from "express";
import type { Request, Response } from "express";
import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

app.use(cors());
app.use(express.json());

const MOCK_TOKENS = {
  "S": {
    "token": "0xC42F6EBD1499c8099cbdde8f108c870fD7Baffa4",
    "staking": "0xC8d619C991066233DC281564Ba8d076e785328CB",
    "nameProject": "SiloV2"
  },
  "wS": {
    "token": "0x09E49F7dB7369B5D36273f96Da18347968889134",
    "staking": "0xB5B9a84B4cEc5381D2F56cB3c05253E9bf060d72",
    "nameProject": "EulerV2"
  },
  "OS": {
    "token": "0xa99027852475c77bC3C340DB883e11632A5A172f",
    "staking": "0xaC60B68dDc47938b4e27b0bBf8b3bb46Afa2619c",
    "nameProject": "Origin Protocol"
  },
  "LBTC": {
    "token": "0xf7b6e1d2fE5C493b1A22e3E93A4c4DE2f1a9b85E",
    "staking": "0x6604Cdd55C119361B6890Bd7e9523e0772e0DC49",
    "nameProject": "Lombard Finance"
  },
  "USDCe": {
    "token": "0x038310f0F5971A025Ff40c0B0BDbC751965dCD72",
    "staking": "0xd7256AeD9e1e04fD9dC5D6eAa38297C8A19C7EF8",
    "nameProject": "SpectraV2"
  }
}

const LOGOS = {
  [MOCK_TOKENS.S.token]: "https://s2.coinmarketcap.com/static/img/coins/200x200/32684.png",
  [MOCK_TOKENS.wS.token]: "https://s2.coinmarketcap.com/static/img/coins/200x200/32684.png",
  [MOCK_TOKENS.OS.token]: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTVVGEyt1Ip718uycWTIw46lUr3YUHdCMX09g&s",
  [MOCK_TOKENS.LBTC.token]: "https://s2.coinmarketcap.com/static/img/coins/200x200/33652.png",
  [MOCK_TOKENS.USDCe.token]: "https://s2.coinmarketcap.com/static/img/coins/200x200/3408.png",
};

const stakingABI = [
  "function fixedAPY() public view returns (uint8)",
  "function totalAmountStaked() public view returns (uint256)",
];

async function updateStakingData(tokenKey: keyof typeof MOCK_TOKENS) {
  try {
    const { token, staking } = MOCK_TOKENS[tokenKey];
    const contract = new ethers.Contract(staking, stakingABI, provider);

    const apy = await contract.fixedAPY();
    const totalStaked = await contract.totalAmountStaked();

    const formattedTVL = Number(ethers.formatUnits(totalStaked, 6));
    const formattedAPY = Number(apy);

    await prisma.staking.upsert({
      where: { addressToken: token },
      update: {
        tvl: formattedTVL,
        apy: formattedAPY,
        updatedAt: new Date()
      },
      create: {
        idProtocol: MOCK_TOKENS[tokenKey].nameProject + "_" + tokenKey,
        addressToken: token,
        addressStaking: staking,
        nameToken: tokenKey,
        nameProject: MOCK_TOKENS[tokenKey].nameProject,
        chain: "Sonic Blaze Testnet",
        apy: formattedAPY,
        stablecoin: tokenKey === "USDCe",
        categories: ["Staking", tokenKey === "USDCe" ? "Stablecoin" : ""].filter(Boolean),
        logo: LOGOS[token] || "",
        tvl: formattedTVL,
      },
    });

    console.log(`Updated staking data for ${tokenKey}`);
  } catch (error) {
    console.error(`Error updating staking data for ${tokenKey}:`, error);
  }
}

const getStakingData = async (req: Request, res: Response) => {
  try {
    const data = await prisma.staking.findMany();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const getStakingByIdProtocol = async (req: any, res: any) => {
  try {
    const data = await prisma.staking.findMany({
      where: { idProtocol: req.params.idProtocol },
    });

    if (!data) {
      return res.status(404).json({ error: "Staking data not found" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const getStakingByAddress = async (req: any, res: any) => {
  try {
    const data = await prisma.staking.findUnique({
      where: { addressToken: req.params.address },
    });

    if (!data) {
      return res.status(404).json({ error: "Staking data not found" });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staking data" });
  }
};

const updateStaking = async (req: Request, res: Response) => {
  try {
    const updatePromises = Object.keys(MOCK_TOKENS).map((tokenKey) =>
      updateStakingData(tokenKey as keyof typeof MOCK_TOKENS)
    );

    await Promise.all(updatePromises);

    res.json({ message: "All staking data updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update staking data" });
  }
};

app.get("/staking", getStakingData);
app.get("/staking/:idProtocol", getStakingByIdProtocol);
app.get("/staking/:address", getStakingByAddress);
app.post("/staking/update", updateStaking);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
