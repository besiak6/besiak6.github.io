const isOtherInBattleRange = (other) => {
  const { x: hx, y: hy } = Engine.hero.d;
  const { x, y } = other.d;
  return Math.max(Math.abs(x - hx), Math.abs(y - hy)) <= 20;
};
const updatePartyMembers = () => {
  if (!Engine.party || !Engine.party.getMembers()) return;
  const others = Engine.others.check();
  const { id: hid } = Engine.hero.d;
  Engine.party.get$Wnd()[0].querySelector(".amount").innerText = `(${
    Engine.party.getMembers().size
  })`;
  Engine.party.getMembers().forEach((c, v) => {
    if (v == hid) return;
    const inRange = others[v] && isOtherInBattleRange(others[v]);
    c.el.querySelector(".nickname-text").style.color = inRange ? "" : "red";
  });
};
const intercept = (obj, key, cb, _ = obj[key]) =>
  (obj[key] = (...args) => {
    const result = _.apply(obj, args);
    return cb(...args) ?? result;
  });
intercept(Engine.communication, "parseJSON", (data) => {
  if (data.h || data.party || data.other) {
    updatePartyMembers();
  }
});
