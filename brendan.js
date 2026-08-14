// brendan.js - Bottom Patrol Pets
document.addEventListener('DOMContentLoaded', () => {
  const showSprites = localStorage.getItem('kaito_show_sprites') !== 'false';
  if (!showSprites) return;

  const hour = new Date().getHours();
  let numPets = 0;
  if (hour >= 5 && hour < 12) numPets = 4; // Ca sáng: 4 con
  else if (hour >= 12 && hour < 18) numPets = 3; // Ca trưa/chiều: 3 con
  else if (hour >= 18 && hour < 22) numPets = 2; // Ca tối: 2 con
  else numPets = 0; // Khuya: nghỉ ngơi

  const allPetsConfig = [
    {
      className: 'brendan-pet',
      x: 10,
      speed: 1.0,
      dir: 'right',
      cls: { left: 'walk-left', right: 'walk-right', down: 'walk-down', up: 'walk-up' }
    },
    {
      className: 'wally-pet',
      x: window.innerWidth / 2,
      speed: 0.9,
      dir: 'left',
      cls: { left: 'wally-walk-left', right: 'wally-walk-right', down: 'wally-walk-down', up: 'wally-walk-up' }
    },
    {
      className: 'brendan3-pet',
      x: window.innerWidth - 80,
      speed: 1.1,
      dir: 'left',
      cls: { left: 'brendan3-walk-left', right: 'brendan3-walk-right', down: 'brendan3-walk-down', up: 'brendan3-walk-up' }
    },
    {
      className: 'new1-pet',
      x: window.innerWidth / 3,
      speed: 1.2,
      dir: 'right',
      width: 125,
      height: 120,
      scale: 0.75,
      flipOnLeft: true,
      skills: ['new1-skill-1', 'new1-skill-2', 'new1-skill-3', 'new1-skill-4'],
      skillInterval: 2000, // Đổi skill mỗi 2 giây
      cls: { left: 'new1-skill-4', right: 'new1-skill-4', down: 'new1-skill-4', up: 'new1-skill-4' }
    }
  ];

  const petsData = [];
  for (let i = 0; i < numPets; i++) {
    const config = allPetsConfig[i];
    const el = document.createElement('div');
    el.classList.add(config.className);
    // Style để có thể kéo thả dễ dàng hơn, và hiển thị "tay" khi di chuột
    el.style.cursor = 'grab';
    el.style.transformOrigin = 'bottom center'; // Anchor bottom cho việc scale không bị lệch xuống đất
    document.body.appendChild(el);
    
    const petData = {
      el: el,
      x: config.x,
      speed: config.speed,
      dir: config.dir,
      cls: config.cls,
      width: config.width || 70,
      height: config.height || 70,
      scale: config.scale || 1.0,
      flipOnLeft: config.flipOnLeft || false,
      skills: config.skills || null,
      currentSkill: 0,
      isDragging: false,
      dragX: 0,
      dragY: 0,
      dragOffsetX: 0,
      dragOffsetY: 0
    };

    // Nếu pet có skills thì tự động xoay vòng
    if (config.skills && config.skills.length > 0) {
      setInterval(() => {
        petData.currentSkill = (petData.currentSkill + 1) % config.skills.length;
        // Cập nhật cls cho tất cả hướng
        const skillClass = config.skills[petData.currentSkill];
        petData.cls = { left: skillClass, right: skillClass, down: skillClass, up: skillClass };
      }, config.skillInterval || 2000);
    }

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
      
      let scaleX = petData.scale;
      if (petData.flipOnLeft && petData.dir === 'left') scaleX = -petData.scale;
      
      petData.el.style.transform = `translate3d(${petData.dragX}px, ${petData.dragY}px, 0) scale(${scaleX}, ${petData.scale})`;
      petData.el.style.zIndex = 9999;
      
      function onMove(e) {
        if(e.cancelable) e.preventDefault();
        const cx = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const cy = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        petData.dragX = cx - petData.dragOffsetX;
        petData.dragY = cy - petData.dragOffsetY;
        
        let scaleX = petData.scale;
        if (petData.flipOnLeft && petData.dir === 'left') scaleX = -petData.scale;
        
        // Cập nhật ngay lập tức thay vì chờ requestAnimationFrame để mượt hơn
        petData.el.style.transform = `translate3d(${petData.dragX}px, ${petData.dragY}px, 0) scale(${scaleX}, ${petData.scale})`;
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
        
        // Cập nhật vị trí X và Y mới sau khi thả
        petData.x = petData.dragX;
        petData.y = petData.dragY;
        
        // Đổi hướng quay mặt xuống dưới để đi bộ xuống đất
        // Chỉ lưu lại hướng cũ nếu nó đang đi ngang (không phải đang rơi)
        if (petData.dir !== 'down') {
          petData.originalDir = petData.dir;
        }
        petData.dir = 'down';
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
    let scaleX = pet.scale;
    if (pet.flipOnLeft && pet.dir === 'left') scaleX = -pet.scale;

    if (pet.isDragging) {
      // Khi đang kéo thì chỉ update vị trí theo chuột, không đi bộ
      pet.el.style.transform = `translate3d(${pet.dragX}px, ${pet.dragY}px, 0) scale(${scaleX}, ${pet.scale})`;
      return;
    }

    const W = window.innerWidth - pet.width;
    const nav = document.querySelector('.tabs-nav');
    
    // Mặc định đi dưới cùng màn hình
    let floorY = window.innerHeight - pet.height;
    
    // Nếu tab nav đang hiển thị thì đi trên viền tab nav
    if (nav && nav.offsetHeight > 0) {
      floorY = nav.getBoundingClientRect().top - pet.height + 15;
    }

    if (pet.isFalling) {
      // Khi rớt, cho đi bộ từ từ xuống dưới
      pet.y += pet.speed * 1.5; // Rơi nhanh hơn đi bộ ngang một xíu
      if (pet.y >= floorY) {
        pet.y = floorY;
        pet.isFalling = false;
        pet.dir = pet.originalDir; // Quay mặt lại hướng cũ khi chạm đất
      }
    } else {
      // Đi bộ ngang bình thường
      pet.y = floorY;
      if (pet.dir === 'left') pet.x -= pet.speed;
      if (pet.dir === 'right') pet.x += pet.speed;

      // Đụng 2 cạnh màn hình thì quay đầu
      if (pet.dir === 'right' && pet.x >= W) { 
        pet.x = W; 
        pet.dir = 'left'; 
      }
      else if (pet.dir === 'left' && pet.x <= 0) { 
        pet.x = 0; 
        pet.dir = 'right'; 
      }
    }

    // Xóa hết class hướng cũ, cập nhật class hướng mới
    pet.el.classList.remove(pet.cls.left, pet.cls.right, 'walk-up', 'walk-down', 'wally-walk-up', 'wally-walk-down', 'brendan3-walk-up', 'brendan3-walk-down', 'new1-skill-1', 'new1-skill-2', 'new1-skill-3', 'new1-skill-4');
    if (pet.cls[pet.dir]) {
      pet.el.classList.add(pet.cls[pet.dir]);
    }

    pet.el.style.transform = `translate3d(${pet.x}px, ${pet.y}px, 0) scale(${scaleX}, ${pet.scale})`;
  }

  function loop() {
    petsData.forEach(pet => updatePet(pet));
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
