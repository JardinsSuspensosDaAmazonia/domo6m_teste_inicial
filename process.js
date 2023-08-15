!function(root){
	var chain = [], io, startLength, timeout = null;
	
	var proc = root.calcProc = _.extend({
		stop: function(){
			if (chain.length){
				proc.trigger('cancel', chain);
			}
			chain = [];
			io = null;
			clearTimeout(timeout);
			timeout = null;
			return this;
		},
		start: function(stages){
			this.stop();
			chain = chain.concat(_.compact(_.flatten(stages)));
			startLength = chain.length;
			proc.trigger('start', chain);
			
			//timeout = true;
			//Promise.resolve().then(tick);
			timeout = setTimeout(tick, 0);
			return this;
		},
		length: function(){
			return chain.length;
		},
		then: function(after) {
			if (!this.length()) {
				after();
			} else {
				function cb() {
					this.off('complete cancel', cb);
					after();
				}
				this.on('complete cancel', cb, this);
			}
		}
	}, Backbone.Events);
	
	function tick() {
		var progress = startLength - chain.length;
		var stage = chain.shift();
		if (stage) {
			proc.trigger('stage', stage, progress, io);
			
			//function nextStep() {
				io = stage.process(io);
				
				if (!io) {
					proc.stop();
					debugger;
				}
				
				proc.trigger('stageOk', stage, progress, io);
			//	setTimeout(tick);
			//}
			
			//timeout && Promise.resolve().then(tick);
			timeout = setTimeout(tick, 0);
		} else {
			timeout = null;
			proc.trigger('complete', chain);
		}
	}
}(window);