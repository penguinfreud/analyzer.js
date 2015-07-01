function Compile(func) {
    var all = [], loops = {}, parent = {};
    
    var map = func.blockMap, block, i, pred, j, id;
    for (i = 1; i<map.length; i++) {
        block = map[i];
        block.isLoopHead = 0;
        id = block.id;
        pred = block.pred;
        for (j = 0; j<pred.length; j++) {
            if (pred[j].id > id) {
                block.isLoopHead = 1;
                console.log(id, "isLoopHead");
                loops[id] = [];
                break;
            }
        }
    }
    
    var dom, query = [], binding = {};
    for (i = 1; i<map.length; i++) {
        block = map[i];
        dom = block.dominator;
        id = block.id;
        query[0] = block;
        while (true) {
            if (!dom) {
                all.push(block);
                parent[id] = all;
                console.log(id, "=> all");
                break;
            } else {
                query[1] = dom;
                if (dom.isLoopHead && $Path.has(query, binding)) {
                    loops[dom.id].push(block);
                    parent[id] = dom;
                    console.log(id, "=>", dom.id);
                    break;
                }
            }
            dom = dom.dominator;
        }
    }
};