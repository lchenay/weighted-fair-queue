var weightedFairQueue = require('../');

var {expect} = require('chai');

describe('WeightedFairQueue', () => {
    it('WeightedFairQueue', (done) => {
        var call_order = [];

        var q = weightedFairQueue((task, callback) => {
            call_order.push('process ' + task);
            callback();
        }, 1);

        q.push(1, 1, () => {
            call_order.push('callback ' + 1);
        });
        q.push(2, 2, () => {
            call_order.push('callback ' + 2);
        });
        q.push(3, 2, () => {
            call_order.push('callback ' + 3);
        });
        q.push(4, 2, () => {
            call_order.push('callback ' + 4);
        });
        q.push(5, 2, () => {
            call_order.push('callback ' + 5);
        });
        q.push(6, 1, () => {
            call_order.push('callback ' + 6);
        });
        q.push(7, 1, () => {
            call_order.push('callback ' + 7);
        });

        q.remove(({data}) => data === 5);

        expect(q.length()).to.equal(6);
        expect(q.concurrency).to.equal(1);
        expect([...q]).to.eql([1, 6, 7, 2, 3, 4]);

        q.drain(() => {
            expect(call_order).to.eql([
                'process 1', 'callback 1',
                'process 2', 'callback 2',
                'process 3', 'callback 3',
                'process 6', 'callback 6',
                'process 4', 'callback 4',
                'process 7', 'callback 7',
            ]);
            expect(q.concurrency).to.equal(1);
            expect(q.length()).to.equal(0);
            done();
        });
    });
});
