const express = require('express');
const { ethers } = require('ethers');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());
// app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// KONFIGURACJA ADMINA
// ==========================================
const ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; 
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; 
const RPC_URL = "http://127.0.0.1:8545";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

const abi = [
    "function authorizeShip(address _ship) external",
    "function latestFleetData() external view returns (string)",
    "function latestTerm() external view returns (uint256)",
    "function currentLeader() external view returns (address)"
];
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, adminWallet);
const activeShips = {};

// ==========================================
// ENDPOINTY API
// ==========================================

app.post('/api/start-ship', async (req, res) => {
    const { port, peers, privateKey } = req.body;

    if (activeShips[port]) {
        return res.status(400).json({ error: "Statek na tym porcie już działa!" });
    }

    try {
        const shipWallet = new ethers.Wallet(privateKey);
        const shipAddress = shipWallet.address;

        console.log(`\n Admin: Autoryzacja statku ${shipAddress}...`);
        const tx = await contract.authorizeShip(shipAddress);
        await tx.wait();
        console.log(` Admin: Zautoryzowano w blockchainie!`);

        console.log(` Uruchamianie procesu Node.js dla portu ${port}...`);
        const shipProcess = spawn('node', ['ships.js', port, peers], {
            env: { ...process.env, PRIVATE_KEY: privateKey, CONTRACT_ADDRESS: CONTRACT_ADDRESS }
        });

        activeShips[port] = shipProcess;
        shipProcess.stdout.on('data', (data) => process.stdout.write(`[PORT ${port}] ${data}`));
        shipProcess.stderr.on('data', (data) => process.stdout.write(`[PORT ${port} ERROR] ${data}`));

        res.json({ success: true, address: shipAddress, message: `Statek uruchomiony!` });
    } catch (error) {
        res.status(500).json({ error: error.reason || error.message });
    }
});

// BEZPIECZNE pobieranie statusu floty z Blockchainu
app.get('/api/fleet-status', async (req, res) => {
    try {
        const term = await contract.latestTerm();
        const leader = await contract.currentLeader();
        const dataStr = await contract.latestFleetData();
        
        let parsedData = null;
        if (dataStr) {
            try {
                parsedData = JSON.parse(dataStr);
            } catch (parseError) {
                // Jeśli JSON jest ucięty lub nieprawidłowy, zwracamy go w oryginalnej formie tekstowej
                parsedData = { surowe_dane: dataStr, uwaga: "Błąd parsowania JSON" };
            }
        }
        
        res.json({ 
            term: term.toString(), 
            leader: leader, 
            data: parsedData 
        });
    } catch (error) {
        console.error("Błąd serwera przy odczycie kontraktu:", error);
        res.status(500).json({ error: "Błąd odczytu z blockchaina: " + error.message });
    }
});

app.listen(3000, () => {
    console.log('\n=============================================');
    console.log('PANEL ADMINA URUCHOMIONY NA http://localhost:3000');
    console.log('=============================================\n');
});
