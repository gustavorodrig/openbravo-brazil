/*
	Copyright (c) 2004-2010, The Dojo Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/


if(!dojo._hasResource["dojox.charting.plot2d.Grid"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["dojox.charting.plot2d.Grid"] = true;
dojo.provide("dojox.charting.plot2d.Grid");

dojo.require("dojox.charting.Element");
dojo.require("dojox.charting.plot2d.common");
dojo.require("dojox.lang.functional");
dojo.require("dojox.lang.utils");

/*=====
dojo.declare("dojox.charting.plot2d.__GridCtorArgs", dojox.charting.plot2d.__DefaultCtorArgs, {
	//	summary:
	//		A special keyword arguments object that is specific to a grid "plot".

	//	hMajorLines: Boolean?
	//		Whether to show lines at the major ticks along the horizontal axis. Default is true.
	hMajorLines: true,

	//	hMinorLines: Boolean?
	//		Whether to show lines at the minor ticks along the horizontal axis. Default is false.
	hMinorLines: false,

	//	vMajorLines: Boolean?
	//		Whether to show lines at the major ticks along the vertical axis. Default is true.
	vMajorLines: true,

	//	vMinorLines: Boolean?
	//		Whether to show lines at the major ticks along the vertical axis. Default is false.
	vMinorLines: false,

	//	hStripes: String?
	//		Whether or not to show stripes (alternating fills) along the horizontal axis. Default is "none".
	hStripes: "none",

	//	vStripes: String?
	//		Whether or not to show stripes (alternating fills) along the vertical axis. Default is "none".
	vStripes: "none"
});
=====*/
(function(){
	var du = dojox.lang.utils, dc = dojox.charting.plot2d.common;

	dojo.declare("dojox.charting.plot2d.Grid", dojox.charting.Element, {
		//	summary:
		//		A "faux" plot that can be placed behind other plots to represent
		//		a grid against which other plots can be easily measured.
		defaultParams: {
			hAxis: "x",			// use a horizontal axis named "x"
			vAxis: "y",			// use a vertical axis named "y"
			hMajorLines: true,	// draw horizontal major lines
			hMinorLines: false,	// draw horizontal minor lines
			vMajorLines: true,	// draw vertical major lines
			vMinorLines: false,	// draw vertical minor lines
			hStripes: "none",	// TBD
			vStripes: "none",	// TBD
			animate: null   // animate bars into place
		},
		optionalParams: {},	// no optional parameters

		constructor: function(chart, kwArgs){
			//	summary:
			//		Create the faux Grid plot.
			//	chart: dojox.charting.Chart2D
			//		The chart this plot belongs to.
			//	kwArgs: dojox.charting.plot2d.__GridCtorArgs?
			//		An optional keyword arguments object to help define the parameters of the underlying grid.
			this.opt = dojo.clone(this.defaultParams);
			du.updateWithObject(this.opt, kwArgs);
			this.hAxis = this.opt.hAxis;
			this.vAxis = this.opt.vAxis;
			this.dirty = true;
			this.animate = this.opt.animate;
			this.zoom = null,
			this.zoomQueue = [];	// zooming action task queue
			this.lastWindow = {vscale: 1, hscale: 1, xoffset: 0, yoffset: 0};
		},
		clear: function(){
			//	summary:
			//		Clear out any parameters set on this plot.
			//	returns: dojox.charting.plot2d.Grid
			//		The reference to this plot for functional chaining.
			this._hAxis = null;
			this._vAxis = null;
			this.dirty = true;
			return this;	//	dojox.charting.plot2d.Grid
		},
		setAxis: function(axis){
			//	summary:
			//		Set an axis for this plot.
			//	returns: dojox.charting.plot2d.Grid
			//		The reference to this plot for functional chaining.
			if(axis){
				this[axis.vertical ? "_vAxis" : "_hAxis"] = axis;
			}
			return this;	//	dojox.charting.plot2d.Grid
		},
		addSeries: function(run){
			//	summary:
			//		Ignored but included as a dummy method.
			//	returns: dojox.charting.plot2d.Grid
			//		The reference to this plot for functional chaining.
			return this;	//	dojox.charting.plot2d.Grid
		},
		getSeriesStats: function(){
			//	summary:
			//		Returns default stats (irrelevant for this type of plot).
			//	returns: Object
			//		{hmin, hmax, vmin, vmax} min/max in both directions.
			return dojo.delegate(dc.defaultStats);
		},
		initializeScalers: function(){
			//	summary:
			//		Does nothing (irrelevant for this type of plot).
			return this;
		},
		isDirty: function(){
			//	summary:
			//		Return whether or not this plot needs to be redrawn.
			//	returns: Boolean
			//		If this plot needs to be rendered, this will return true.
			return this.dirty || this._hAxis && this._hAxis.dirty || this._vAxis && this._vAxis.dirty;	//	Boolean
		},
		performZoom: function(dim, offsets){
			//	summary:
			//		Create/alter any zooming windows on this plot.
			//	dim: Object
			//		An object of the form { width, height }.
			//	offsets: Object
			//		An object of the form { l, r, t, b }.
			//	returns: dojox.charting.plot2d.Grid
			//		A reference to this plot for functional chaining.

			// get current zooming various
			var vs = this._vAxis.scale || 1,
				hs = this._hAxis.scale || 1,
				vOffset = dim.height - offsets.b,
				hBounds = this._hAxis.getScaler().bounds,
				xOffset = (hBounds.from - hBounds.lower) * hBounds.scale,
				vBounds = this._vAxis.getScaler().bounds,
				yOffset = (vBounds.from - vBounds.lower) * vBounds.scale;
				// get incremental zooming various
				rVScale = vs / this.lastWindow.vscale,
				rHScale = hs / this.lastWindow.hscale,
				rXOffset = (this.lastWindow.xoffset - xOffset)/
					((this.lastWindow.hscale == 1)? hs : this.lastWindow.hscale),
				rYOffset = (yOffset - this.lastWindow.yoffset)/
					((this.lastWindow.vscale == 1)? vs : this.lastWindow.vscale),

				shape = this.group,
				anim = dojox.gfx.fx.animateTransform(dojo.delegate({
					shape: shape,
					duration: 1200,
					transform:[
						{name:"translate", start:[0, 0], end: [offsets.l * (1 - rHScale), vOffset * (1 - rVScale)]},
						{name:"scale", start:[1, 1], end: [rHScale, rVScale]},
						{name:"original"},
						{name:"translate", start: [0, 0], end: [rXOffset, rYOffset]}
					]}, this.zoom));

			dojo.mixin(this.lastWindow, {vscale: vs, hscale: hs, xoffset: xOffset, yoffset: yOffset});
			//add anim to zooming action queue,
			//in order to avoid several zooming action happened at the same time
			this.zoomQueue.push(anim);
			//perform each anim one by one in zoomQueue
			dojo.connect(anim, "onEnd", this, function(){
				this.zoom = null;
				this.zoomQueue.shift();
				if(this.zoomQueue.length > 0){
					this.zoomQueue[0].play();
				}
			});
			if(this.zoomQueue.length == 1){
				this.zoomQueue[0].play();
			}
			return this;	//	dojox.charting.plot2d.Grid
		},
		getRequiredColors: function(){
			//	summary:
			//		Ignored but included as a dummy method.
			//	returns: Number
			//		Returns 0, since there are no series associated with this plot type.
			return 0;	//	Number
		},
		render: function(dim, offsets){
			//	summary:
			//		Render the plot on the chart.
			//	dim: Object
			//		An object of the form { width, height }.
			//	offsets: Object
			//		An object of the form { l, r, t, b }.
			//	returns: dojox.charting.plot2d.Grid
			//		A reference to this plot for functional chaining.
			if(this.zoom){
				return this.performZoom(dim, offsets);
			}
			this.dirty = this.isDirty();
			if(!this.dirty){ return this; }
			this.cleanGroup();
			var s = this.group, ta = this.chart.theme.axis;
			// draw horizontal stripes and lines
			try{
				var vScaler = this._vAxis.getScaler(),
					vt = vScaler.scaler.getTransformerFromModel(vScaler),
					ticks = this._vAxis.getTicks();
				if(this.opt.hMinorLines){
					dojo.forEach(ticks.minor, function(tick){
						var y = dim.height - offsets.b - vt(tick.value);
						var hMinorLine = s.createLine({
							x1: offsets.l,
							y1: y,
							x2: dim.width - offsets.r,
							y2: y
						}).setStroke(ta.minorTick);
						if(this.animate){
							this._animateGrid(hMinorLine, "h", offsets.l, offsets.r + offsets.l - dim.width);
						}
					}, this);
				}
				if(this.opt.hMajorLines){
					dojo.forEach(ticks.major, function(tick){
						var y = dim.height - offsets.b - vt(tick.value);
						var hMajorLine = s.createLine({
							x1: offsets.l,
							y1: y,
							x2: dim.width - offsets.r,
							y2: y
						}).setStroke(ta.majorTick);
						if(this.animate){
							this._animateGrid(hMajorLine, "h", offsets.l, offsets.r + offsets.l - dim.width);
						}
					}, this);
				}
			}catch(e){
				// squelch
			}
			// draw vertical stripes and lines
			try{
				var hScaler = this._hAxis.getScaler(),
					ht = hScaler.scaler.getTransformerFromModel(hScaler),
					ticks = this._hAxis.getTicks();
				if(ticks && this.opt.vMinorLines){
					dojo.forEach(ticks.minor, function(tick){
						var x = offsets.l + ht(tick.value);
						var vMinorLine = s.createLine({
							x1: x,
							y1: offsets.t,
							x2: x,
							y2: dim.height - offsets.b
						}).setStroke(ta.minorTick);
						if(this.animate){
							this._animateGrid(vMinorLine, "v", dim.height - offsets.b, dim.height - offsets.b - offsets.t);
						}
					}, this);
				}
				if(ticks && this.opt.vMajorLines){
					dojo.forEach(ticks.major, function(tick){
						var x = offsets.l + ht(tick.value);
						var vMajorLine = s.createLine({
							x1: x,
							y1: offsets.t,
							x2: x,
							y2: dim.height - offsets.b
						}).setStroke(ta.majorTick);
						if(this.animate){
							this._animateGrid(vMajorLine, "v", dim.height - offsets.b, dim.height - offsets.b - offsets.t);
						}
					}, this);
				}
			}catch(e){
				// squelch
			}
			this.dirty = false;
			return this;	//	dojox.charting.plot2d.Grid
		},
		_animateGrid: function(shape, type, offset, size){
			var transStart = type == "h" ? [offset, 0] : [0, offset];
			var scaleStart = type == "h" ? [1/size, 1] : [1, 1/size];
			dojox.gfx.fx.animateTransform(dojo.delegate({
				shape: shape,
				duration: 1200,
				transform: [
					{name: "translate", start: transStart, end: [0, 0]},
					{name: "scale", start: scaleStart, end: [1, 1]},
					{name: "original"}
				]
			}, this.animate)).play();
		}
	});
})();

}
