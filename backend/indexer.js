/*
 * Minimal indexer for LaunchIt events.
 * Listens for events emitted by the Factory and BondingCurveSale contracts and
 * writes them to a JSON file for consumption by the frontend. In production
 * this should be replaced with a proper database and hosted backend.
 */
const { ethers } = require('ethers');
const fs = require('fs');

// Replace with your deployed contract addresses
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
const FACTORY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'launchId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: true, internalType: 'address', name: 'sale', type: 'address' },
      { indexed: false, internalType: 'bool', name: 'externalToken', type: 'bool' },
      { indexed: false, internalType: 'address', name: 'creator', type: 'address' },
    ],
    name: 'LaunchCreated',
    type: 'event',
  },
];
const SALE_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'bnbIn', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'fee', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'netBNB', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'tokensOut', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'tierStart', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'tiersCrossed', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'soldAfter', type: 'uint256' },
    ],
    name: 'Bought',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'raised', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'lpBNB', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'lpTokens', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'listingPrice', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'lockUntil', type: 'uint256' },
    ],
    name: 'Finalized',
    type: 'event',
  },
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://bsc-dataseed.binance.org/');
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const launches = [];
  // read past events
  const past = await factory.queryFilter(factory.filters.LaunchCreated());
  past.forEach((ev) => {
    launches.push({
      id: ev.args.launchId.toNumber(),
      token: ev.args.token,
      sale: ev.args.sale,
      external: ev.args.externalToken,
      creator: ev.args.creator,
    });
  });
  fs.writeFileSync('launches.json', JSON.stringify(launches, null, 2));
  console.log('Loaded', launches.length, 'launches');
  // subscribe to new events
  factory.on('LaunchCreated', (launchId, token, sale, externalToken, creator) => {
    launches.push({
      id: launchId.toNumber(),
      token,
      sale,
      external: externalToken,
      creator,
    });
    fs.writeFileSync('launches.json', JSON.stringify(launches, null, 2));
    console.log('New launch', sale);
  });
}
main().catch((err) => console.error(err));