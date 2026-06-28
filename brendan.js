// brendan.js - Bottom Patrol Pets
document.addEventListener('DOMContentLoaded', () => {
  const showSprites = localStorage.getItem('kaito_show_sprites') !== 'false';
  if (!showSprites) return;

  const petWidth = 70; 
  const petHeight = 70; 

  const hour = new Date().getHours();
  let numPets = 0;
  if (hour >= 5 && hour < 12) numPets = 3; // Ca sáng: 3 con
  else if (hour >= 12 && hour < 18) numPets = 2; // Ca trưa/chiều: 2 con
  else if (hour >= 18 && hour < 22) numPets = 1; // Ca tối: 1 con
  else numPets = 0; // Khuya: nghỉ ngơi

  const allPetsConfig = [
    {
      className: 'brendan-pet',
      x: 10,
      speed: 1.0,
      dir: 'right',
      cls: { left: 'walk-left', right: 'walk-right' }
    },
    {
      className: 'wally-pet',
      x: window.innerWidth / 2,
      speed: 0.9,
      dir: 'left',
      cls: { left: 'wally-walk-left', right: 'wally-walk-right' }
    },
    {
      className: 'brendan3-pet',
      x: window.innerWidth - petWidth - 10,
      speed: 1.1,
      dir: 'left',
      cls: { left: 'brendan3-walk-left', right: 'brendan3-walk-right' }
    }
  ];

  const petsData = [];
  for (let i = 0; i < numPets; i++) {
    const config = allPetsConfig[i];
    const el = document.createElement('div');
    el.classList.add(config.className);
    // Style để có thể kéo thả dễ dàng hơn, và hiển thị "tay" khi di chuột
    el.style.cursor = 'grab';
    document.body.appendChild(el);
    
    const petData = {
      el: el,
      x: config.x,
      speed: config.speed,
      dir: config.dir,
      cls: config.cls,
      isDragging: false,
      dragX: 0,
      dragY: 0,
      dragOffsetX: 0,
      dragOffsetY: 0
    };

    // --- Drag and Drop Logic ---
    function startDrag(e) {
      if(e.cancelable) e.preventDefault();
      petData.isDragging = true;
      petData.el.style.transition = 'none'; // Tắt transition khi đang kéo
      petData.el.style.cursor = 'grabbing';
      
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      
      const rect = petData.el.getBoundingClientRect();
      petData.dragOffsetX = clientX - rect.left;
      petData.dragOffsetY = clientY - rect.top;
      
      petData.dragX = clientX - petData.dragOffsetX;
      petData.dragY = clientY - petData.dragOffsetY;
      
      petData.el.style.transform = `translate3d(${petData.dragX}px, ${petData.dragY}px, 0)`;
      petData.el.style.zIndex = 9999;
      
      function onMove(e) {
        if(e.cancelable) e.preventDefault();
        const cx = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const cy = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        petData.dragX = cx - petData.dragOffsetX;
        petData.dragY = cy - petData.dragOffsetY;
        // Cập nhật ngay lập tức thay vì chờ requestAnimationFrame để mượt hơn
        petData.el.style.transform = `translate3d(${petData.dragX}px, ${petData.dragY}px, 0)`;
      }
      
      function onEnd(e) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        
        petData.isDragging = false;
        petData.isFalling = true; // Đánh dấu đang rơi
        petData.el.style.zIndex = '';
        petData.el.style.cursor = 'grab';
        
        // Cập nhật vị trí X mới sau khi thả
        petData.x = petData.dragX;
        
        // Tính toán floorY (mặt đất) để thả xuống
        let floorY = window.innerHeight - petHeight;
        const nav = document.querySelector('.tabs-nav');
        if (nav && nav.offsetHeight > 0) {
          floorY = nav.getBoundingClientRect().top - petHeight + 15;
        }

        // Thêm hiệu ứng rơi xuống nhẹ nhàng
        petData.el.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        // Bắt đầu cho rơi xuống mặt đất ngay lập tức
        petData.el.style.transform = `translate3d(${petData.x}px, ${floorY}px, 0)`;
        
        // Xóa transition sau khi rơi xong để nó tiếp tục đi bộ dọc trục ngang bình thường
        setTimeout(() => {
          if (!petData.isDragging) {
             petData.isFalling = false;
             petData.el.style.transition = '';
          }
        }, 500);
      }
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, {passive: false});
      document.addEventListener('touchend', onEnd);
    }

    petData.el.addEventListener('mousedown', startDrag);
    petData.el.addEventListener('touchstart', startDrag, {passive: false});
    
    petsData.push(petData);
  }

  function updatePet(pet) {
    if (pet.isDragging || pet.isFalling) {
      // Khi đang kéo HOẶC đang rơi thì không đi bộ, không đổi transform để transition tự làm mượt
      return;
    }

    const W = window.innerWidth - petWidth;
    const nav = document.querySelector('.tabs-nav');
    
    // Mặc định đi dưới cùng màn hình
    let floorY = window.innerHeight - petHeight;
    
    // Nếu tab nav đang hiển thị thì đi trên viền tab nav
    if (nav && nav.offsetHeight > 0) {
      floorY = nav.getBoundingClientRect().top - petHeight + 15;
    }

    // Di chuyển theo hướng hiện tại
    if (pet.dir === 'left') pet.x -= pet.speed;
    if (pet.dir === 'right') pet.x += pet.speed;

    pet.el.style.animationPlayState = 'running';

    // Đụng 2 cạnh màn hình thì quay đầu
    if (pet.dir === 'right' && pet.x >= W) { 
      pet.x = W; 
      pet.dir = 'left'; 
    }
    else if (pet.dir === 'left' && pet.x <= 0) { 
      pet.x = 0; 
      pet.dir = 'right'; 
    }

    // Xóa hết class hướng cũ, cập nhật class hướng mới
    pet.el.classList.remove(pet.cls.left, pet.cls.right, 'walk-up', 'walk-down', 'wally-walk-up', 'wally-walk-down', 'brendan3-walk-up', 'brendan3-walk-down');
    pet.el.classList.add(pet.cls[pet.dir]);

    pet.el.style.transform = `translate3d(${pet.x}px, ${floorY}px, 0)`;
  }

  function loop() {
    petsData.forEach(pet => updatePet(pet));
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
