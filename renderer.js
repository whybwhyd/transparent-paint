const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const toolbar = document.getElementById('toolbar');
const toggleLockBtn = document.getElementById('toggle-lock');
const clearBtn = document.getElementById('clear');

// 1. 캔버스 크기 초기화
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let drawing = false;
let currentColor = 'red';
let isActive = true; // 기본값: 그리기 모드 활성화
let lastIgnoreState = null;

// [수정된 통합 제어 함수]
function updateMouseIgnore(ignore, forward = false) {
    if (lastIgnoreState !== ignore) {
        ipcRenderer.send('set-ignore-mouse', ignore, forward ? { forward: true } : {});
        lastIgnoreState = ignore;
    }
}
// [전체 지우기 함수]
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- [이벤트 리스너 영역] ---

// 2. ESC 키 감지 (전체 지우기)
// [ESC 지우기 및 컬러 버튼 동일]
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// 3. 활성/비활성화 버튼 (토글)
toggleLockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isActive = !isActive;
    
    if (isActive) {
        toggleLockBtn.innerText = "그리기 모드 (활성)";
        toggleLockBtn.style.background = "white";
        // 활성화 시 즉시 클릭을 받을 수 있는 상태로 변경 시도
        updateMouseIgnore(false); 
    } else {
        toggleLockBtn.innerText = "마우스 모드 (비활성)";
        toggleLockBtn.style.background = "#ffcccc";
        drawing = false;
        updateMouseIgnore(true, true); // 비활성화 즉시 투과
    }
    console.log("현재 모드:", isActive ? "그리기 활성" : "마우스 투과");
});

// 4. 지우기 버튼 클릭
clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearCanvas();
});

// 5. 컬러 변경 버튼들
const colors = ['red', 'blue', 'green', 'black'];
colors.forEach(color => {
    document.getElementById(color)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isActive) {
            currentColor = color;
            console.log("색상 변경:", currentColor);
        }
    });
});

// 6. 마우스 움직임 감지 (투과 제어 + 그리기)
// [마우스 움직임 감지] - 이 부분이 핵심 수정 사항입니다.
window.addEventListener('mousemove', (e) => {
    const isOverToolbar = toolbar.contains(e.target);

    if (!isActive) {
        // [비활성화 모드] 툴바 아니면 100% 투과
        updateMouseIgnore(!isOverToolbar, true);
    } else {
        // [활성화 모드] 
        // 주석을 풀어도 그림이 그려지게 하려면, 
        // 활성화 상태에서는 투과(true)를 하지 않고 마우스를 계속 잡고(false) 있어야 합니다.
        // 그래야 mousedown 이벤트가 발생합니다.
        updateMouseIgnore(false); 

        if (drawing) {
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.strokeStyle = currentColor;
            ctx.lineTo(e.clientX, e.clientY);
            ctx.stroke();
        }
    }
});

// 7. 그리기 시작
window.addEventListener('mousedown', (e) => {
    if (!isActive) return;
    if (!toolbar.contains(e.target)) {
        drawing = true;
        ctx.beginPath();
        ctx.moveTo(e.clientX, e.clientY);
        // 클릭하는 순간 다시 한번 확실히 마우스를 잡습니다.
        updateMouseIgnore(false);
    }
});

// 8. 그리기 종료
window.addEventListener('mouseup', () => {
    drawing = false;
    
    if (isActive) {
        // 그리기 모드일 때는 마우스를 떼도 계속 마우스를 잡고 있어야 
        // 다음 클릭(그리기 시작)을 인식할 수 있습니다.
        updateMouseIgnore(false);
    } else {
        // 비활성화 모드일 때만 툴바 밖에서 투과시킵니다.
        if (!toolbar.matches(':hover')) {
            updateMouseIgnore(true, true);
        }
    }
});

// 시작 시 초기 설정: 버튼을 눌러야 하므로 처음엔 마우스를 잡습니다.
updateMouseIgnore(false);