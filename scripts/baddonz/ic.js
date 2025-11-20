(function () {
    function mergeSimilarItems(itemId) {
        const item = Engine.items.getItemById(itemId);
        if (!item || item._cachedStats.cansplit !== '1') return;

        const { x, y, name, id } = item;
        const remainingSlots = parseInt(item._cachedStats.capacity) - parseInt(item._cachedStats.amount);

        const similarItems = Engine.items.fetchLocationItems('g')
            .filter(it => it.name === name && it.id !== id)
            .map(({ id, _cachedStats }) => ({
                id,
                amount: parseInt(_cachedStats.amount),
            }))
            .sort((a, b) => a.amount - b.amount);

        const itemsToUse = similarItems.reduce((acc, { id, amount }) => {
            if (acc.rem < 0) return acc;
            return {
                ids: [...acc.ids, id],
                rem: acc.rem - amount,
            };
        }, { ids: [], rem: remainingSlots }).ids;

        const next = () => {
            if (!itemsToUse.length) return;
            const id = itemsToUse.shift();
            _g(`moveitem&st=0&id=${id}&x=${x}&y=${y}`, next);
        };

        next();
    }
    const intercept = (obj, key, cb, _ = obj[key]) => obj[key] = (...args) => {
        cb(...args);
        return _.apply(obj, args);
    };
    intercept(Engine.interface, 'showPopupMenu', (options, event) => {
        const id = event.target?.className?.match(/item-id-(\d+)/)?.[1];
        const item = Engine.items.getItemById(id);
        if (!item || item._cachedStats.cansplit !== '1') return;
        const index = Math.max(0, options.length - 1);
        options.splice(index, 0, [
            'Połącz te same',
            () => mergeSimilarItems(parseInt(id)),
            { button: { cls: 'menu-item--green' } }
        ]);
    });

})();
