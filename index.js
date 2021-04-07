const async = require('async');

/**
 * The same as [async.queue]{@link module:ControlFlow.queue} only tasks are assigned a priority and
 * completed in ascending priority order.
 *
 * @name WeightedFairQueue
 * @static
 * @memberOf module:ControlFlow
 * @method
 * @see [async.queue]{@link module:ControlFlow.queue}
 * @category Control Flow
 * @param {AsyncFunction} worker - An async function for processing a queued task.
 * If you want to handle errors from an individual task, pass a callback to
 * `q.push()`.
 * Invoked with (task, callback).
 * @param {number} concurrency - An `integer` for determining how many `worker`
 * functions should be run in parallel.  If omitted, the concurrency defaults to
 * `1`.  If the concurrency is `0`, an error is thrown.
 * @returns {module:ControlFlow.QueueObject} A priorityQueue object to manage the tasks. There are two
 * differences between `queue` and `priorityQueue` objects:
 * * `push(task, priority, [callback])` - `priority` should be a number. If an
 *   array of `tasks` is given, all tasks will be assigned the same priority.
 * * The `unshift` method was removed.
 */
module.exports = function(worker, concurrency) {
    // Start with a normal queue
    var q = async.queue(worker, concurrency);
    var processingScheduled = false;

    q._tasks = {
      heaps: {},
      priorities:[],
      cursor:0,
      shiftCount: 0,

      get length() {
        return this.priorities.reduce(
          (acc, prio) => acc + this.heaps[prio].length, 0
        );
      },

      empty () {
          this.heaps = {};
          this.priorities = [];
          this.cursor = 0;
          this.shiftCount = 0;

          return this;
      },

      getHeap(node) {
        if (undefined == this.heaps[node.priority]) {
          this.heaps[node.priority] = [];
          this.priorities.push(node.priority);
        }
        return this.heaps[node.priority];
      },

      push(node) {
        this.getHeap(node).push(node);
      },

      unshift(node) {
        this.getHeap(node).unshift(node);
      },

      shift() {
          const task = this.heaps[this.priorities[this.cursor]].shift();
          this.shiftCount++;

          this.checkAfterRemove(this.cursor);

          return task;
      },

      checkAfterRemove(cursor) {
        let currentHeap = this.heaps[this.priorities[cursor]];

        if (currentHeap.length == 0) {
          delete this.heaps[this.priorities[cursor]];
          delete this.priorities.splice(cursor, 1);
          this.shiftCount = 0;
        }

        if (this.cursor != cursor) {
          return;
        }

        if (undefined == this.priorities[this.cursor]) {
          this.cursor = 0;
          return;
        }

        if (this.shiftCount >= this.priorities[this.cursor]) {
            this.cursor++;
            this.shiftCount = 0;

            if (this.cursor >= this.priorities.length) {
              this.cursor = 0;
            }
        }
      },

      toArray() {
        return [].concat(...Object.values(this.heaps))
      },

      *[Symbol.iterator] () {
        for (var i = 0, li = this.priorities.length; i < li ; i++) {
          let heap = this.heaps[this.priorities[i]];

          for (var j = 0 , lj = heap.length ; j < lj ; j++ ) {
            yield heap[j].data
          }
        }
      },

      remove(testFn) {
        for (var i = 0, l = this.priorities.length ; i < l ; i++) {
          const priority = this.priorities[i]
          this.heaps[priority] = this.heaps[priority].filter(node => !testFn(node));
          this.checkAfterRemove(i);
        }

        return this;
      },
    }

    // Override push to accept second parameter representing priority
    q.push = function(data, priority = 1, callback = () => {}) {
        if (typeof callback !== 'function') {
            throw new Error('task callback must be a function');
        }

        if (!Number.isInteger(priority) || priority < 1) {
            throw new Error('priority must be an integer stricly positive');
        }

        q.started = true;
        if (!Array.isArray(data)) {
            data = [data];
        }
        if (data.length === 0 && q.idle()) {
            // call drain immediately if there are no tasks
            return async.setImmediate(() => q.drain());
        }

        for (var i = 0, l = data.length; i < l; i++) {
            var item = {
                data: data[i],
                priority,
                callback
            };

            q._tasks.push(item);
        }

        if (!processingScheduled) {
            processingScheduled = true;
            async.setImmediate(() => {
                processingScheduled = false;
                q.process();
            });
        }
    };

    // Remove unshift function
    delete q.unshift;

    return q;
}
