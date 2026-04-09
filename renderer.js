const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const toolbar = document.getElementById('toolbar');
const toggleLockBtn = document.getElementById('toggle-lock');
const clearBtn = document.getElementById('clear');
const colorPicker = document.getElementById('color-picker');
const toolbarOpacityBtn = document.getElementById('toolbar-opacity-btn');
const toolbarOpacityModal = document.getElementById('toolbar-opacity-modal');
const toolbarOpacitySlider = document.getElementById('toolbar-opacity-slider');
//const toolbarOpacityContainer = document.getElementById('toolbar-opacity-container');
const toolbarOpacityValue = document.getElementById('toolbar-opacity-value');
// [추가] 되돌리기용 스택
let undoStack = [];
const MAX_UNDO = 20; // 최대 20개까지만 저장 (메모리 관리용)

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

// --- [추가] 툴바 드래그 변수 ---
let isDragging = false;
let offset = { x: 0, y: 0 };

// [통합 제어 함수]
function updateMouseIgnore(ignore, forward = false) {
    if (lastIgnoreState !== ignore) {
        ipcRenderer.send('set-ignore-mouse', ignore, forward ? { forward: true } : {});
        lastIgnoreState = ignore;
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- [이벤트 리스너 영역] ---

// 2. ESC 키 감지 (전체 지우기)
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearCanvas();
});

// 3. 활성/비활성화 버튼
toggleLockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isActive = !isActive;
    
    if (isActive) {
        toggleLockBtn.innerText = "🔓활성화";
        toggleLockBtn.style.background = "white";
        updateMouseIgnore(false); 
    } else {
        toggleLockBtn.innerText = "🔒비활성";
        toggleLockBtn.style.background = "#b4b4b4ff";
        drawing = false;
        updateMouseIgnore(true, true); 
    }
});

// 4. 지우기 버튼 클릭
clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearCanvas();
});

// 5. 컬러 변경 (버튼 & 팔레트)
const colors = ['white','yellow','red', 'blue',  'black'];
colors.forEach(color => {
    document.getElementById(color)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isActive) {
            currentColor = color;
            colorPicker.value = (color === 'black') ? '#000000' : color;
        }
    });
});

colorPicker.addEventListener('input', (e) => {
    if (isActive) {
        currentColor = e.target.value;
    }
});

// 6. 마우스 움직임 감지 (드래그 + 투과 + 그리기 통합)
window.addEventListener('mousemove', (e) => {
    // [A] 툴바 드래그 중인 경우
    if (isDragging) {
        let newX = e.clientX - offset.x;
        let newY = e.clientY - offset.y;
        
        // 화면 경계 제한
        newX = Math.max(0, Math.min(window.innerWidth - toolbar.offsetWidth, newX));
        newY = Math.max(0, Math.min(window.innerHeight - toolbar.offsetHeight, newY));

        toolbar.style.left = `${newX}px`;
        toolbar.style.top = `${newY}px`;
        toolbar.style.bottom = 'auto';
        toolbar.style.right = 'auto';
        return; // 드래그 시 그리기 로직 건너뜀
    }

   const isOverToolbar = toolbar.contains(e.target);
    // [추가] 모달이 열려있는지 확인
    const isModalOpen = !toolbarOpacityModal.classList.contains('hidden');

    if (!isActive) {
        // [수정] 툴바 위거나 '모달이 열려있을 때'는 투과하지 않음(false)
        if (isOverToolbar || isModalOpen) {
            updateMouseIgnore(false);
        } else {
            updateMouseIgnore(true, true);
        }
    } else {
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

// 7. 마우스 누름 (그리기 시작 또는 드래그 시작)
window.addEventListener('mousedown', (e) => {
    const isOverToolbar = toolbar.contains(e.target);

    // 툴바 드래그 로직 (버튼이나 입력창이 아닌 툴바 자체를 클릭했을 때)
    if (isOverToolbar && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        isDragging = true;
        offset.x = e.clientX - toolbar.offsetLeft;
        offset.y = e.clientY - toolbar.offsetTop;
        return;
    }

    // 그리기 로직
    if (isActive && !isOverToolbar) {
        drawing = true;
        ctx.beginPath();
        ctx.moveTo(e.clientX, e.clientY);
        updateMouseIgnore(false);
    }
});

// [추가] 현재 상태 저장 함수
function saveState() {
    if (undoStack.length >= MAX_UNDO) {
        undoStack.shift(); // 오래된 데이터 삭제
    }
    undoStack.push(canvas.toDataURL());
}

// 8. 마우스 뗌
window.addEventListener('mouseup', () => {
    if (drawing) {
        saveState(); // [추가] 선 그리기가 끝나면 현재 상태 저장
    }
    
    isDragging = false; // 드래그 종료
    drawing = false;    // 그리기 종료
    
    const isModalOpen = !toolbarOpacityModal.classList.contains('hidden');

    if (isActive) {
        updateMouseIgnore(false);
    } else {
        // [수정] 모달이 열려있다면 마우스를 떼도 투과하지 않고 기다림
        if (isModalOpen || toolbar.matches(':hover')) {
            updateMouseIgnore(false);
        } else {
            updateMouseIgnore(true, true);
        }
    }
});

// 9. [핵심] Ctrl + Z 이벤트 리스너
window.addEventListener('keydown', (e) => {
    // Ctrl + Z (맥은 MetaKey) 감지
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); // 브라우저 기본 동작 방지
        undo();
    }
});

function undo() {
    if (undoStack.length === 0) return;

    // 현재 상태는 버리고 이전 상태를 꺼냄
    undoStack.pop(); 
    
    // 캔버스를 깨끗이 지움
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (undoStack.length > 0) {
        // 마지막 저장된 이미지 데이터 불러오기
        let lastState = undoStack[undoStack.length - 1];
        let img = new Image();
        img.src = lastState;
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
        };
    }
}
document.getElementById('undo-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    undo();
});
//-----------------투명도 조절--------------------
// 1. 버튼 클릭 시 모달 토글
toolbarOpacityBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toolbarOpacityModal.classList.toggle('hidden');
});

// 2. 슬라이더나 모달 내부 클릭 시 닫히지 않게 방지
toolbarOpacityModal.addEventListener('mousedown', (e) => {
    e.stopPropagation();
});

// 3. 모달 외부 어디든 클릭하면 닫기
window.addEventListener('mousedown', (e) => {
    // 툴바 투명도 버튼 자체를 누를 때도 닫히는 현상을 막으려면 
    // 클래스 존재 여부만 체크하는 것이 가장 깔끔합니다.
    if (!toolbarOpacityModal.classList.contains('hidden')) {
        toolbarOpacityModal.classList.add('hidden');
    }
});

// 4. 투명도 조절 로직
toolbarOpacitySlider.addEventListener('input', (e) => {
    const val = e.target.value; 
    const alpha = val / 100; 

    // 툴바 전체 투명도 변경
    toolbar.style.opacity = alpha;
    
    // [수정] 선언된 변수명에 맞춰 toolbarOpacityValueDisplay -> toolbarOpacityValue로 변경
    if (toolbarOpacityValue) {
        toolbarOpacityValue.innerText = `${val}%`;
    }
});
// 초기 설정
updateMouseIgnore(false);