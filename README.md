# ⚓ SafeFleet

**Zdecentralizowany system zarządzania flotą statków IoT wykorzystujący algorytm konsensusu Raft oraz sieć Ethereum (Web3).**

Projekt demonstruje, w jaki sposób urządzenia IoT (statki) mogą autonomicznie organizować się w sieć Peer-to-Peer, wybierać lidera i bezpiecznie raportować zgrupowane dane telemetryczne (GPS) do smart kontraktu na blockchainie, drastycznie redukując koszty transakcji (Gas fees).

---

## 🌟 Główne funkcjonalności

* **Autonomiczny algorytm Raft (P2P):** Statki komunikują się ze sobą przez protokół UDP bez udziału centralnego serwera. Posiadają mechanizm wykrywania sąsiadów (Discovery), dynamicznego wyboru Lidera (Leader Election) oraz rotacji władzy co 4 minuty.
* **Optymalizacja kosztów Web3:** Zamiast wysyłać pojedyncze, drogie transakcje, statki-followerzy przesyłają swoje pozycje GPS do Lidera. Tylko Lider paczkuje te dane i wykonuje jeden zbiorczy zapis na blockchainie co 60 sekund.
* **Smart Kontrakt z Białą Listą:** Kontrakt `FleetRegistry.sol` pozwala na modyfikację bazy danych floty wyłącznie zautoryzowanym adresom (statkom zatwierdzonym przez administratora).
* **Centrum Dowodzenia (C2 Panel):** Aplikacja webowa (Express.js) pozwalająca na żywo dodawać statki, uruchamiać je jako procesy w tle i podglądać odczyty bezpośrednio z węzła blockchain.

---

## 🏗️ Architektura Systemu

1. **Frontend (Dashboard):** Interfejs HTML/JS do zarządzania węzłami i podglądu danych z łańcucha bloków.
2. **Backend (Admin Server):** Node.js + Express. Autoryzuje statki używając portfela Admina i zarządza procesami potomnymi (Child Processes).
3. **Flota (Skrypty Statków):** Węzły Node.js działające na lokalnych portach, wykorzystujące zmodyfikowany algorytm Raft do utrzymania konsensusu i zarządzania telemetryką.
4. **Blockchain (Foundry/Anvil):** Lokalny węzeł Ethereum testujący logikę smart kontraktów i przechowujący ostateczne stany (Single Source of Truth).

---

## ⚙️ Wymagania wstępne

Aby uruchomić projekt, upewnij się, że masz zainstalowane:
* **Node.js** (v16 lub wyższy) oraz `npm`
* **Foundry** (dostarcza `forge` i `anvil` do obsługi lokalnego blockchaina) -> [Instrukcja instalacji Foundry](https://book.getfoundry.sh/getting-started/installation)

---

## 🚀 Szybki start (Quick Start)

Poniższe instrukcje zakładają, że używasz dwóch osobnych okien terminala.

### Terminal 1: Lokalny Blockchain
```bash
# 0. Uruchom węzeł testowy Ethereum (zostaw ten proces w tle)
anvil

# 1. Przejdź do głównego folderu z projektem
cd FLEET-CONTRACTS

# 2. Wdróż smart kontrakt do lokalnej sieci
forge create src/FleetRegistry.sol:FleetRegistry \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --rpc-url [http://127.0.0.1:8545](http://127.0.0.1:8545) \
  --legacy \
  --broadcast

# UWAGA: Skopiuj adres kontraktu z wyniku komendy (Deployed to: 0x...) 
# i zaktualizuj zmienną CONTRACT_ADDRESS wewnątrz pliku server.js!

# 3. Zainstaluj wymagane pakiety Node.js
npm install express ethers

# 4. Uruchom serwer głównego panelu
node server.js
```

---

## 🎮 Użytkowanie - Panel GUI

1. Otwórz przeglądarkę i wejdź na: http://localhost:3000
2. W formularzu "Dodaj nowy statek" podaj parametry pierwszej jednostki:
   - Port: 4001
   - Peers: 4002,4003
   - Klucz Prywatny: <Klucz konta nr 1 z okna Anvil>
3. Kliknij "Zautoryzuj w Smart Kontrakcie i Uruchom".
4. Dodaj kolejne statki (np. porty 4002 i 4003) przypisując im nowe klucze prywatne.

Oczekiwany rezultat:
> Statki same nawiążą połączenie UDP (Raft).
> Jeden z nich zostanie wyłoniony jako Lider Floty.
> W prawym panelu GUI zaczną pojawiać się zsynchronizowane koordynaty GPS całej floty pobierane bezpośrednio z Blockchaina.
