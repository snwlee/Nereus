// 고정 픽스처 — 손으로 지어낸 코드가 아니다.
//
// 출처: FindDifferences3D `find_differences_3d_app/assets/html/js/difference_engine.js`
//       커밋 b3f3952 (2026-07-05) 의 `disposeSubtree` 를 그대로 옮겼다.
// 관찰: 2026-09-13. 2026-09-14 에 도너가 이 결함을 **고쳤다**(속성 순회로 교체).
//
// 왜 고정하는가: 도너는 **우리가 통제하지 않는 남의 작업트리**다.
// 라이브 도너에 "이 결함이 있어야 한다"를 걸면, 남이 자기 버그를 고치는 순간
// 우리 검사기가 맞는데도 테스트가 빨개진다. 실제로 하루 만에 그렇게 됐다.
// 그래서 "실제 세상에서 나온 결함"은 여기 고정하고,
// 라이브 도너에는 **변하지 않는 성질**(거짓 양성 없음 등)만 단언한다.
function disposeSubtree(object) {
  object.traverse((child) => {
    if (child.geometry && typeof child.geometry.dispose === 'function') {
      child.geometry.dispose();
    }
    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => {
        if (material.map && material.map.dispose) material.map.dispose();
        if (material.dispose) material.dispose();
      });
    }
  });
}

disposeSubtree(root);
