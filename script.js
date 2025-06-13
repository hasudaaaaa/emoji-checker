const imageUpload = document.getElementById('imageUpload');
const colorPicker = document.getElementById('colorPicker');
const hexColorDisplay = document.getElementById('hexColorDisplay');
const previewArea = document.getElementById('previewArea');
const previewImage = document.getElementById('previewImage');
const placeholderText = document.getElementById('placeholderText');
const calculateButton = document.getElementById('calculateButton');
const averageContrastSpan = document.getElementById('averageContrast');
const minContrastSpan = document.getElementById('minContrast');
const wcagAaRatioSpan = document.getElementById('wcagAaRatio');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const ctx = hiddenCanvas.getContext('2d');

let uploadedImage = null; // アップロードされたImageオブジェクトを保持

// ヘックスカラーをRGBオブジェクトに変換
function hexToRgb(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return { r, g, b };
}

// RGB値をヘックスカラーに変換
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// 相対輝度を計算 (WCAG 2.0/2.1のアルゴリズム)
function getLuminance(r, g, b) {
    const RsRGB = r / 255;
    const GsRGB = g / 255;
    const BsRGB = b / 255;

    const R = (RsRGB <= 0.03928) ? RsRGB / 12.92 : Math.pow((RsRGB + 0.055) / 1.055, 2.4);
    const G = (GsRGB <= 0.03928) ? GsRGB / 12.92 : Math.pow((GsRGB + 0.055) / 1.055, 2.4);
    const B = (BsRGB <= 0.03928) ? BsRGB / 12.92 : Math.pow((BsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// コントラスト比を計算
function getContrastRatio(L1, L2) {
    // L1は明るい方の輝度、L2は暗い方の輝度
    if (L1 < L2) {
        [L1, L2] = [L2, L1]; // スワップしてL1が常に大きいことを保証
    }
    return (L1 + 0.05) / (L2 + 0.05);
}

// 画像アップロード時の処理
imageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                uploadedImage = img; // Imageオブジェクトを保存
                previewImage.src = e.target.result;
                previewImage.classList.remove('hidden');
                placeholderText.classList.add('hidden');
                
                // プレビューエリアの背景色を更新
                previewArea.style.backgroundColor = colorPicker.value;
            };
            img.onerror = () => {
                console.error("画像の読み込みに失敗しました。");
                alert("画像の読み込みに失敗しました。無効な画像ファイルかもしれません。");
                resetApp();
            };
            img.crossOrigin = "anonymous"; // CORS対応
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.error("ファイルの読み込みに失敗しました。");
            alert("ファイルの読み込みに失敗しました。");
            resetApp();
        };
        reader.readAsDataURL(file);
    } else {
        resetApp();
    }
});

// カラーピッカーの値変更時の処理
colorPicker.addEventListener('input', (event) => {
    const hexColor = event.target.value;
    hexColorDisplay.textContent = hexColor.toUpperCase();
    previewArea.style.backgroundColor = hexColor; // プレビューエリアの背景色を更新
});

// コントラスト計算ボタンクリック時の処理
calculateButton.addEventListener('click', () => {
    if (!uploadedImage) {
        alert("画像をアップロードしてください。");
        return;
    }

    // キャンバスを画像のサイズに設定
    hiddenCanvas.width = uploadedImage.naturalWidth;
    hiddenCanvas.height = uploadedImage.naturalHeight;

    // キャンバスに画像を描画
    ctx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height); // キャンバスをクリア
    ctx.drawImage(uploadedImage, 0, 0);

    // 背景色をRGBオブジェクトに変換
    const backgroundColorHex = colorPicker.value;
    const backgroundRgb = hexToRgb(backgroundColorHex);
    const backgroundLuminance = getLuminance(backgroundRgb.r, backgroundRgb.g, backgroundRgb.b);

    // ピクセルデータを取得
    const imageData = ctx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    const data = imageData.data; // RGBAのUint8ClampedArray

    let totalContrastRatio = 0;
    let minContrastRatio = Infinity;
    let wcagAaPassCount = 0;
    let pixelCount = 0;

    // 全ピクセルをループしてコントラストを計算
    for (let i = 0; i < data.length; i += 4) {
        const rImg = data[i];
        const gImg = data[i + 1];
        const bImg = data[i + 2];
        const aImg = data[i + 3] / 255; // アルファ値を0-1に正規化

        // 画像のピクセルと背景色の合成色を計算
        const rBlended = Math.round(rImg * aImg + backgroundRgb.r * (1 - aImg));
        const gBlended = Math.round(gImg * aImg + backgroundRgb.g * (1 - aImg));
        const bBlended = Math.round(bImg * aImg + backgroundRgb.b * (1 - aImg));

        // 合成色の輝度を計算
        const blendedLuminance = getLuminance(rBlended, gBlended, bBlended);

        // 背景色と合成色のコントラスト比を計算
        const contrastRatio = getContrastRatio(blendedLuminance, backgroundLuminance);

        totalContrastRatio += contrastRatio;
        minContrastRatio = Math.min(minContrastRatio, contrastRatio);

        // WCAG AA (通常テキスト) 基準チェック
        if (contrastRatio >= 4.5) {
            wcagAaPassCount++;
        }
        pixelCount++;
    }

    const averageContrast = totalContrastRatio / pixelCount;
    const wcagAaRatio = (wcagAaPassCount / pixelCount) * 100;

    averageContrastSpan.textContent = averageContrast.toFixed(2) + ":1";
    minContrastSpan.textContent = minContrastRatio.toFixed(2) + ":1";
    wcagAaRatioSpan.textContent = wcagAaRatio.toFixed(2) + "%";
});

// アプリケーションの状態をリセットする関数
function resetApp() {
    uploadedImage = null;
    previewImage.src = "";
    previewImage.classList.add('hidden');
    placeholderText.classList.remove('hidden');
    imageUpload.value = ''; // ファイル選択をクリア
    colorPicker.value = '#CCCCCC'; // 背景色をデフォルトに戻す
    hexColorDisplay.textContent = '#CCCCCC';
    previewArea.style.backgroundColor = '#CCCCCC';
    averageContrastSpan.textContent = "N/A";
    minContrastSpan.textContent = "N/A";
    wcagAaRatioSpan.textContent = "N/A";
    ctx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height); // キャンバスをクリア
}

// 初期ロード時にリセット
resetApp();
