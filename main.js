import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm';
import { timelineData } from './data.js';

class Timeline {
  constructor() {
    this.width = window.innerWidth - 100;
    this.height = 800;
    this.margin = { top: 60, right: 50, bottom: 60, left: 50 };
    this.currentData = [...timelineData];
    this.colors = {
      ancient: '#ffd700',
      medieval: '#ff6b6b',
      modern: '#4ecdc4',
      digital: '#45b7d1'
    };
    this.currentZoom = d3.zoomIdentity;
    this.baseHeight = this.height - this.margin.bottom;
    this.simulation = null;
    this.init();
  }

  init() {
    this.setupSVG();
    this.setupScales();
    this.setupTooltip();
    this.setupZoom();
    this.setupEventListeners();
    this.render();
  }

  setupSVG() {
    this.svg = d3.select('#timeline')
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);

    const gradient = this.svg.append('defs')
      .append('linearGradient')
      .attr('id', 'timeline-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', this.width)
      .attr('y2', 0);

    gradient.selectAll('stop')
      .data([
        { offset: '0%', color: '#0f3460' },
        { offset: '100%', color: '#e94560' }
      ])
      .enter()
      .append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);

    this.mainGroup = this.svg.append('g').attr('class', 'main-group');
    this.baseGroup = this.svg.append('g').attr('class', 'timeline-base');
  }

  setupScales() {
    this.x = d3.scaleLinear()
      .domain([d3.min(timelineData, d => d.year), d3.max(timelineData, d => d.year)])
      .range([this.margin.left, this.width - this.margin.right]);

    this.y = d3.scaleLinear()
      .domain([0, this.currentData.length])
      .range([this.baseHeight - 200, this.margin.top]);

    this.radius = d3.scaleLinear()
      .domain([0, 100])
      .range([8, 20]);
  }

  setupZoom() {
    this.zoom = d3.zoom()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        this.currentZoom = event.transform;
        this.mainGroup.attr('transform', event.transform);
        this.updateTimelineBase(event.transform);
      });

    this.svg.call(this.zoom);
  }

  setupTooltip() {
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip');
  }

  setupForceSimulation() {
    if (this.simulation) this.simulation.stop();

    this.simulation = d3.forceSimulation(this.currentData)
      .force('x', d3.forceX(d => this.x(d.year)).strength(0.8))
      .force('y', d3.forceY(d => this.y(this.currentData.indexOf(d))).strength(0.1))
      .force('collision', d3.forceCollide().radius(30))
      .force('charge', d3.forceManyBody().strength(-50))
      .on('tick', () => this.updatePositions());

    setTimeout(() => this.simulation.stop(), 3000);
  }

  updateTimelineBase(transform) {
    const xAxis = d3.axisBottom(transform.rescaleX(this.x))
      .tickFormat(d => d < 0 ? Math.abs(d) + ' BCE' : d + ' CE')
      .ticks(10);

    this.baseGroup.select('.x-axis').call(xAxis);
  }

  updatePositions() {
    const events = this.mainGroup.selectAll('.event');

    events.attr('transform', d => {
      d.x = Math.max(this.margin.left, Math.min(this.width - this.margin.right, d.x));
      d.y = Math.max(this.margin.top, Math.min(this.baseHeight - 50, d.y));
      return `translate(${d.x}, ${d.y})`;
    });

    events.select('.event-line')
      .attr('y2', d => this.baseHeight - d.y);
  }

  setupEventListeners() {
    const buttons = ['viewAll', 'ancient', 'medieval', 'modern', 'digital'];
    buttons.forEach(id => {
      d3.select(`#${id}`).on('click', (event) => {
        d3.selectAll('.controls button').classed('active', false);
        d3.select(event.target).classed('active', true);
        this.filterByEra(id === 'viewAll' ? 'all' : id);
      });
    });

    d3.select('#zoomIn').on('click', () => {
      this.svg.transition().duration(750).call(this.zoom.scaleBy, 1.5);
    });

    d3.select('#zoomOut').on('click', () => {
      this.svg.transition().duration(750).call(this.zoom.scaleBy, 0.75);
    });

    d3.select('#reset').on('click', () => {
      this.svg.transition().duration(750).call(this.zoom.transform, d3.zoomIdentity);
    });

    const resizeObserver = new ResizeObserver(() => {
      this.width = window.innerWidth - 100;
      this.svg.attr('width', this.width);
      this.setupScales();
      this.render();
    });

    resizeObserver.observe(document.querySelector('#timeline'));
  }

  filterByEra(era) {
    if (this.simulation) this.simulation.stop();
    this.currentData = era === 'all' ? [...timelineData] : timelineData.filter(d => d.era === era);
    this.render();
  }

  render() {
    this.mainGroup.selectAll('*').remove();
    this.baseGroup.selectAll('*').remove();

    this.baseGroup.append('line')
      .attr('x1', this.margin.left)
      .attr('x2', this.width - this.margin.right)
      .attr('y1', this.baseHeight)
      .attr('y2', this.baseHeight);

    const xAxis = d3.axisBottom(this.x)
      .tickFormat(d => d < 0 ? Math.abs(d) + ' BCE' : d + ' CE')
      .ticks(10);

    this.baseGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.baseHeight})`)
      .call(xAxis);

    this.currentData.forEach((d, i) => {
      d.x = this.x(d.year);
      d.y = this.y(i);
    });

    const events = this.mainGroup.selectAll('.event')
      .data(this.currentData)
      .enter()
      .append('g')
      .attr('class', 'event')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    events.append('line')
      .attr('class', 'event-line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', d => this.baseHeight - d.y);

    events.append('circle')
      .attr('r', 0)
      .attr('fill', d => this.colors[d.era])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 0 8px rgba(0,0,0,0.3))')
      .transition()
      .duration(1000)
      .attr('r', d => this.radius(d.impact));

    const labels = events.append('g')
      .attr('class', 'label-group')
      .attr('transform', 'translate(10, 0)');

    labels.append('text')
      .attr('class', 'event-label')
      .attr('text-anchor', 'start')
      .style('opacity', 0)
      .style('font-weight', 'bold')
      .text(d => d.event)
      .transition()
      .duration(1000)
      .style('opacity', 1);

    labels.append('text')
      .attr('class', 'event-label')
      .attr('text-anchor', 'start')
      .attr('dy', '1.2em')
      .style('opacity', 0)
      .style('font-size', '10px')
      .text(d => `${d.year < 0 ? Math.abs(d.year) + ' BCE' : d.year + ' CE'}`)
      .transition()
      .duration(1000)
      .style('opacity', 0.7);

    events
      .on('mouseover', (event, d) => {
        this.tooltip
          .style('opacity', 1)
          .html(`
            <h3>${d.event}</h3>
            <p><strong>Year:</strong> ${d.year < 0 ? Math.abs(d.year) + ' BCE' : d.year + ' CE'}</p>
            <p>${d.description}</p>
            <p><strong>Impact:</strong> ${d.impact}/100</p>
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');

        d3.select(event.currentTarget)
          .select('circle')
          .transition()
          .duration(300)
          .attr('r', d => this.radius(d.impact) * 1.5)
          .style('filter', 'drop-shadow(0 0 12px rgba(255,255,255,0.3))');
      })
      .on('mouseout', (event) => {
        this.tooltip.style('opacity', 0);
        d3.select(event.currentTarget)
          .select('circle')
          .transition()
          .duration(300)
          .attr('r', d => this.radius(d.impact))
          .style('filter', 'drop-shadow(0 0 8px rgba(0,0,0,0.3))');
      });

    this.mainGroup.attr('transform', this.currentZoom);
    this.setupForceSimulation();
  }
}

new Timeline();
