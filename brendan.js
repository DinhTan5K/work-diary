// brendan.js - Edge Patrol Pets
document.addEventListener('DOMContentLoaded', () => {
  const petWidth = 70; 
  const petHeight = 70; 

  // Tạo thẻ div cho các con pet
  const brendan = document.createElement('div');
  brendan.classList.add('brendan-pet'); 
  document.body.appendChild(brendan);

  const wally = document.createElement('div');
  wally.classList.add('wally-pet'); 
  document.body.appendChild(wally);

  const brendan3 = document.createElement('div');
  brendan3.classList.add('brendan3-pet'); 
  document.body.appendChild(brendan3);

  // Quản lý trạng thái
  const petsData = [
    {
      el: brendan,
      x: 0, y: 0, // Xuất phát Góc trên-trái
      speed: 1.5,
      dir: 'right', clockWise: true, // Đi theo chiều kim đồng hồ
      cls: { up: 'walk-up', down: 'walk-down', left: 'walk-left', right: 'walk-right' }
    },
    {
      el: wally,
      x: window.innerWidth - petWidth, y: window.innerHeight - petHeight, // Góc dưới-phải
      speed: 1.2,
      dir: 'left', clockWise: true, // Chiều kim đồng hồ
      cls: { up: 'wally-walk-up', down: 'wally-walk-down', left: 'wally-walk-left', right: 'wally-walk-right' }
    },
    {
      el: brendan3,
      x: window.innerWidth - petWidth, y: 0, // Góc trên-phải
      speed: 1.8,
      dir: 'left', clockWise: false, // Ngược chiều kim đồng hồ
      cls: { up: 'brendan3-walk-up', down: 'brendan3-walk-down', left: 'brendan3-walk-left', right: 'brendan3-walk-right' }
    }
  ];

  function updatePet(pet) {
    const W = window.innerWidth - petWidth;
    const H = window.innerHeight - petHeight;

    // Sửa lỗi nếu đổi kích thước cửa sổ thì pet không bị văng ra ngoài
    if (pet.x > W) pet.x = W;
    if (pet.y > H) pet.y = H;

    // Di chuyển theo hướng hiện tại
    if (pet.dir === 'up') pet.y -= pet.speed;
    if (pet.dir === 'down') pet.y += pet.speed;
    if (pet.dir === 'left') pet.x -= pet.speed;
    if (pet.dir === 'right') pet.x += pet.speed;

    pet.el.style.animationPlayState = 'running';

    // Đụng góc tường thì quẹo 90 độ ôm sát tường
    if (pet.clockWise) {
      if (pet.dir === 'right' && pet.x >= W) { pet.x = W; pet.dir = 'down'; }
      else if (pet.dir === 'down' && pet.y >= H) { pet.y = H; pet.dir = 'left'; }
      else if (pet.dir === 'left' && pet.x <= 0) { pet.x = 0; pet.dir = 'up'; }
      else if (pet.dir === 'up' && pet.y <= 0) { pet.y = 0; pet.dir = 'right'; }
    } else {
      // Ngược chiều kim đồng hồ
      if (pet.dir === 'left' && pet.x <= 0) { pet.x = 0; pet.dir = 'down'; }
      else if (pet.dir === 'down' && pet.y >= H) { pet.y = H; pet.dir = 'right'; }
      else if (pet.dir === 'right' && pet.x >= W) { pet.x = W; pet.dir = 'up'; }
      else if (pet.dir === 'up' && pet.y <= 0) { pet.y = 0; pet.dir = 'left'; }
    }

    // Xóa hết class hướng cũ, cập nhật class hướng mới
    pet.el.classList.remove(pet.cls.up, pet.cls.down, pet.cls.left, pet.cls.right);
    pet.el.classList.add(pet.cls[pet.dir]);

    pet.el.style.transform = `translate3d(${pet.x}px, ${pet.y}px, 0)`;
  }

  function loop() {
    petsData.forEach(pet => updatePet(pet));
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
