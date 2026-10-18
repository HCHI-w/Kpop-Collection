# My K-pop Collection

繁體中文 K-pop 實體專輯收藏圖鑑 MVP。使用原生 HTML、CSS、JavaScript ES Modules 與獨立 JSON 目錄，無框架、資料庫、建置步驟或正式環境依賴，可直接部署到 GitHub Pages 子路徑。

## 功能

- 團體選擇（第一版 TWICE）、10 張真實專輯的部分示範目錄。
- 年份、韓國／日本發行、專輯類型交叉篩選；名稱搜尋（忽略大小寫，支援全形正規化）。
- 專輯總覽與可直接編輯的版本詳細收藏；獨立的「已擁有」與「想要」清單。
- 每個版本可同時已擁有與想要；支援 0–9999 整數張數。
- 版本未確認的張數暫存與轉移，轉移後實體總張數不變。
- 分別統計專輯種數、已確認版本種數、實體張數、想要版本種數／專輯種數。
- 即時 localStorage 儲存、同源分頁同步、儲存失敗回復畫面、損壞資料保護與原檔救援下載。
- JSON 備份下載、格式與 schemaVersion 驗證、匯入預覽、合併／覆蓋、覆蓋前確認。
- 手機每排 2 張，桌面 4～6 張；原生模態視窗、鍵盤焦點、Escape 關閉與減少動態效果支援。

## 本機預覽

不需要 `npm install`。請使用 HTTP 伺服器，直接開啟 `file://` 會使 ES Modules 或 JSON fetch 被瀏覽器封鎖。

```sh
cd Kpop-Collection
python3 -m http.server 8000
```

瀏覽 [http://localhost:8000](http://localhost:8000)。也可以執行 `npm run preview`（需 Python 3）。

要重現 GitHub Pages 子路徑，請從儲存庫的上一層執行：

```sh
python3 -m http.server 8000
```

瀏覽 [http://localhost:8000/Kpop-Collection/](http://localhost:8000/Kpop-Collection/)。路徑大小寫須與本機目錄一致。

## 部署到 GitHub Pages

1. 合併程式碼到 `main`。
2. 前往儲存庫 **Settings → Pages → Build and deployment**。
3. Source 選擇 **Deploy from a branch**，Branch 選擇 **main / (root)**，儲存。
4. 等待 GitHub Pages 部署完成，使用 Settings 顯示的網站網址。

本儲存庫的預期網址為 `https://hchi-w.github.io/Kpop-Collection/`，需完成上述設定後才會上線。`.nojekyll` 可跳過 Jekyll 處理。沒有必要把網站移至 `docs/`、安裝套件或產生 `dist/`。

所有站內 CSS、模組、JSON、圖片與首頁連結皆使用相對路徑。JSON 內圖片路徑相對於網站根目錄（`index.html`），不是 JSON 所在目錄。外部資料來源連結僅供閱讀，網站載入與收藏操作不依賴外站。

## 檔案結構

```text
index.html                  語意化頁面、導覽、篩選與備份視窗
css/style.css               中性色圖鑑設計、響應式與互動樣式
js/
  app.js                    UI、事件、視窗、備份流程與儲存錯誤處理
  catalog.js                目錄載入、驗證、名稱搜尋與篩選
  collection.js             收藏模型、統計、合併、轉移、匯入驗證與 localStorage
assets/
  favicon.svg               自製網站圖示
  covers/*.svg              自製文字佔位封面，非官方美術
data/
  groups.json               團體與各團體目錄路徑
  twice/albums.json         專輯目錄（名稱、日期、地區、類型、圖片、來源）
  twice/versions.json       實體版本目錄（專輯關聯、名稱、媒介、來源）
tests/
  collection.test.js        Node 內建測試，無第三方依賴
  browser.mjs               Chromium DevTools Protocol 瀏覽器整合測試
.github/workflows/checks.yml  PR／push 時執行核心測試與 JS 語法檢查
.nojekyll                   GitHub Pages 靜態部署標記
```

## 收藏模型與計數

儲存鍵：`my-kpop-collection:v1`。不以陣列索引或顯示名稱作為識別，也不將個人收藏資料存入目錄 JSON。

```json
{
  "schemaVersion": 1,
  "versions": {
    "twice-ready-to-be-ready": {
      "albumId": "twice-ready-to-be",
      "quantity": 2,
      "wanted": true
    }
  },
  "pending": {
    "twice-ready-to-be": { "quantity": 1 }
  }
}
```

這個例子表示 **1 種專輯、1 種已確認版本、3 張實體（含 1 張未確認）、1 種想要版本**。READY TO BE 的其他版本不會自動被視為已擁有。

- 已擁有由 `quantity > 0` 推導，避免布林值與張數矛盾。勾選已擁有至少設為 1 張，取消設為 0；想要狀態獨立。
- 未確認張數是「尚未分配到版本」的額外實體，不是整張專輯的總張數。請勿把已確認的張數再填入暫存。
- 使用「轉移到此版本」會減少未確認張數並增加該版本張數，總張數不變。
- 頁首統計目前團體的完整收藏，不受搜尋／篩選影響。已擁有清單包含僅有未確認張數的專輯；想要清單以明確版本為準。
- 目錄外 ID 會完整保留於儲存與備份，但不加入目前圖鑑統計。未來補入相同穩定 ID，即可重新顯示收藏。

## 備份與匯入規則

使用右上角「匯入 / 匯出」。下載的備份另帶 `app` 與 `exportedAt` 欄位。

匯入上限為 2 MB／10,000 筆紀錄。檢查 JSON 物件、`schemaVersion: 1`、必要欄位、ID、整數張數、布林狀態，以及已知版本的專輯關聯。未知 ID 可保留；無效或較新 schema 不會寫入現有收藏。版本 ID 與專輯對應衝突會拒絕匯入或合併。

**合併**：相同版本張數取兩份資料的較大值，想要狀態取聯集。未確認張數以兩份資料中較大的該專輯實體總數，扣除合併後已確認張數，再取不小於 0 的值。重複匯入不累加；舊備份裡已轉成版本的暫存不會復活。

例：舊備份是 3 張未確認，現有收藏是 READY 版本 2 張＋未確認 1 張；合併後仍為 3 張，不會變成 5 張。若兩個裝置各有不同的未確認實體，MVP 無法辨認單張實體身分，採保守去重，請於匯入後自行核對暫存張數。

**覆蓋**：通過驗證後仍須使用者再次確認，才以備份取代全部團體的收藏。建議先匯出現有資料。匯入前不會清除 localStorage，寫入失敗會保留原狀態。

若讀取到損壞／不支援的收藏資料，會保留原始值、暫停修改並提供「下載原始資料」。可使用有效備份，以「覆蓋」並確認來修復。若瀏覽器禁止儲存或空間不足，會明確顯示未儲存且回復控制項。

收藏屬於瀏覽器的 origin：不同裝置、瀏覽器、網域、HTTP／HTTPS 不會共用。同一 GitHub Pages 網域下的不同專案會共用 localStorage 命名空間；若部署本專案的多個獨立副本，請在 `collection.js` 調整 `STORAGE_KEY`。沒有雲端同步，清除網站資料會刪除收藏。

## 示範目錄與資料來源

| 專輯 | 發行日 | 地區／類型 | 收錄版本範圍 |
| --- | --- | --- | --- |
| THE STORY BEGINS | 2015-10-20 | 韓國／迷你 | Original |
| PAGE TWO | 2016-04-25 | 韓國／迷你 | Pink、Mint |
| twicetagram | 2017-10-30 | 韓國／正規 | 暫不收錄版本，先使用未確認張數 |
| Candy Pop | 2018-02-07 | 日本／單曲 | 通常盤 |
| BDZ | 2018-09-12 | 日本／正規 | 通常盤 |
| Feel Special | 2019-09-23 | 韓國／迷你 | A、B、C |
| Eyes wide open | 2020-10-26 | 韓國／正規 | Story、Style、Retro |
| Celebrate | 2022-07-27 | 日本／正規 | 通常盤 |
| BETWEEN 1&2 | 2022-08-26 | 韓國／迷你 | Archive、Cryptography、Pathfinder、Complete |
| READY TO BE | 2023-03-10 | 韓國／迷你 | READY、TO、BE 寫真書版本 |

共 10 張專輯、19 種示範實體版本；是部分目錄，不能用來判斷完整發行數或全部版本集齊率。twicetagram 的包裝、表面處理與版本分類尚未納入，避免把未核實的分類寫成已確認版本。尚未包含 Digipack、黑膠、店鋪限定、簽名、隨機小卡或全部再版。

資料參考：[JYP 官方專輯目錄](https://twice.jype.com/discography)、[PAGE TWO 官方頁](https://twice.jype.com/discography/yw7w9t50)、[Candy Pop 官方專頁](https://www.twicejapan.com/feature/candypop)、[BDZ 官方專頁](https://www.twicejapan.com/feature/bdz)、[Celebrate 官方專頁](https://www.twicejapan.com/feature/Celebrate)、[READY TO BE JYP SHOP](https://m.en.thejypshop.com/product/twice-12th-mini-album-ready-to-be/1234/)、[Once Collector 發行目錄](https://oncecollector.com/discography)。各 JSON 紀錄另有來源連結。此站為非官方個人收藏工具。

### 增加專輯或版本

1. 在 `data/twice/albums.json` 的 `albums` 陣列新增專輯，填寫唯一且永久的 `id`、`groupId`、`name`、`releaseDate`（ISO 日期）、`region`（`KR`／`JP`）、`type`（`mini`／`studio`／`single`）、`cover`、`coverAlt`、`coverIsPlaceholder`、`versionsComplete`、`catalogNote`、`sources`。
2. 在 `data/twice/versions.json` 的 `versions` 陣列新增已核實版本，填寫永久 `id`、對應 `albumId`、`name`、`format`、`source`。沒有把握的版本先不新增，使用專輯暫存功能。
3. 圖片放入 `assets/covers/`，`cover` 使用 `./assets/covers/檔名`。確認圖片授權後才替換，填寫來源／授權資訊、更新 `coverAlt` 並設 `coverIsPlaceholder: false`；不用更改專輯或版本 ID。
4. 執行測試；目前目錄測試刻意固定 MVP 10 張／全佔位範圍，擴充時同步更新這些資料斷言與表格。

新增團體：建立 `data/團體ID/albums.json`、`versions.json`（各自含 `schemaVersion: 1`），再加入 `data/groups.json` 的 `groups` 陣列，包含永久 `id`、`name`、`description`、`albumsPath`、`versionsPath`。UI 會自動產生團體選擇與對應統計／年份。所有目錄 ID 必須跨團體唯一，建議使用 `團體-專輯-版本`。

不要重用、重新命名或刪除已有的穩定 ID。新增資料不需修改收藏 schema，也不應清空 localStorage。若未來改動收藏格式，應新增明確 migration，保留舊鍵直到成功遷移；不要直接提高版本號後丟棄舊資料。

## 測試

需 Node.js 22+，不需安裝 npm 依賴：

```sh
npm test
node --check js/app.js
node --check js/catalog.js
node --check js/collection.js
```

瀏覽器整合測試需要 Chromium（預設 `/usr/bin/chromium`，可用 `CHROMIUM_BIN` 指定）。先從儲存庫上一層啟動 port 8000 的 HTTP 伺服器，另開終端在本儲存庫執行：

```sh
npm run test:browser
# 不同網址可使用：
TEST_URL=http://localhost:8000/ npm run test:browser
```

腳本會使用獨立暫存瀏覽器設定檔與示範收藏，結束後移除，**不讀取你的日常瀏覽器收藏**。輸出到忽略的 `test-results/`（桌面／手機截圖、結果 JSON）。不需 Playwright 或瀏覽器擴充套件。

自動化涵蓋：

- 核心 9 項測試：目錄與相對圖片、版本獨立收藏、數量／未確認轉移、合併去重、未知 ID 保留、輸入驗證、交叉篩選、儲存錯誤。
- Chromium 實際載入子路徑，篩選、搜尋、空結果、兩種檢視、雙重收藏狀態、正確統計、重新整理保留。
- 實際下載 JSON、壞檔與不支援版本拒絕、重複合併、覆蓋取消與確認、還原備份。
- 1600／1280／1024 桌面與 375／320 手機寬度、2～6 欄、無水平溢出、視窗 Escape 關閉。
- 模擬 localStorage 寫入空間不足、損壞原資料保留與修復，無未捕捉 JS／console error 或失敗的靜態資源請求。

本次實測（2026-10-18）：核心測試 **9/9 通過**；Chromium 上述整合流程全部通過，無 JavaScript 錯誤與資源載入失敗。已檢視 1600px 桌面及 375px 手機截圖。

尚未涵蓋真實 iOS Safari／Firefox、螢幕閱讀器人工驗收、跨裝置同步（非 MVP 功能），也未代替你完成 GitHub Pages 正式環境啟用與驗收。

## 隱私與後續建議

沒有帳號、分析追蹤、API 上傳或伺服器收藏儲存；個人收藏只寫入 localStorage，匯出與救援檔不會自動提交至 Git。`.gitignore` 排除預設備份檔名與測試產物；若自行更名備份，仍請不要放入公開儲存庫。

下一步可補齊並核實 TWICE 全目錄、取得封面授權、加入其他團體，再考慮單張實體識別以改善跨裝置合併，以及收藏格式遷移工具。
