const dgram = require('dgram');
const { ethers } = require('ethers');
const RaftNode = require('./raft');

const MY_PORT = parseInt(process.argv[2]);
const PEERS = process.argv[3].split(',').map(Number);
const socket = dgram.createSocket('udp4');

function sendMessage(targetPort, messageObj) {
    const messageBuffer = Buffer.from(JSON.stringify(messageObj));
    socket.send(messageBuffer, 0, messageBuffer.length, targetPort, '127.0.0.1');
}

const raft = new RaftNode(MY_PORT, PEERS, sendMessage);

socket.on('message', (msgBuffer) => {
    try {
        raft.handleMessage(JSON.parse(msgBuffer.toString()));
    } catch (e) {
        console.error("Błąd parsowania:", e);
    }
});

// SYMULACJA GPS (Co 20 sekund)
let currentLat = 54.3520 + (MY_PORT % 10) * 0.1;
let currentLon = 18.6466 + (MY_PORT % 10) * 0.1;

setInterval(() => {
    currentLat += (Math.random() - 0.5) * 0.001;
    currentLon += (Math.random() - 0.5) * 0.001;
    const locationData = { lat: currentLat.toFixed(5), lon: currentLon.toFixed(5), time: new Date().toLocaleTimeString() };

    if (raft.currentLeaderId) {
        if (raft.state === 'LEADER') {
            raft.fleetLocations[MY_PORT] = locationData;
        } else {
            sendMessage(raft.currentLeaderId, { type: 'GPS_REPORT', senderId: MY_PORT, data: locationData });
            console.log(`[Statek ${MY_PORT}] Wysłano status GPS -> Lider ${raft.currentLeaderId} (${locationData.time})`);
        }
    }
}, 20000); // 20 sekund

// BLOCKCHAIN SETUP
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

let contract;
if (PRIVATE_KEY && CONTRACT_ADDRESS) {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    // Funkcja view do odczytania najnowszej kadencji
    const abi = [
        "function updateFleetData(uint256 _term, string calldata _fleetDataJson) external",
        "function latestTerm() external view returns (uint256)" 
    ];
    contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
} else {
    console.warn("Błąd: Brak klucza prywatnego lub adresu kontraktu!");
}

raft.on('submitToBlockchain', async (fleetData) => {
    console.log(`\n=== PRÓBA ZAPISU DO BLOCKCHAINU (Lider ${MY_PORT}) ===`);
    if (!contract) return;

    try {
        const tx = await contract.updateFleetData(raft.currentTerm, JSON.stringify(fleetData));
        console.log(`Zatwierdzanie w sieci... Hash: ${tx.hash}`);
        await tx.wait();
        console.log(`Zapisano pomyślnie w Ethereum!`);
    } catch (error) {
        console.error("Błąd transakcji:", error.reason || error.message);
    }
});

// START APLIKACJI (Z synchronizacją)
async function init() {
    if (contract) {
        try {
            // Przed startem odpytujemy kontrakt o najnowszą kadencję
            const onChainTerm = await contract.latestTerm();
            raft.currentTerm = Number(onChainTerm);
            console.log(`Zsynchronizowano kadencję z blockchainem: ${raft.currentTerm}`);
        } catch(e) {
            console.log("Informacja: Kontrakt jest nowy, brak poprzednich kadencji.");
        }
    }

    socket.bind(MY_PORT, () => {
        console.log(`Statek ${MY_PORT} uruchomiony i czeka na kontakt.`);
        raft.startDiscovery(); // Włączamy system "wypatrywania" innych statków
    });
}

init();
