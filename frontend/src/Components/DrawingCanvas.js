import React, {Component} from 'react';
import {Image, Layer, Rect, Text, Transformer} from 'react-konva';
import {Fab} from '@material-ui/core';
import {Check} from '@material-ui/icons';
import DeleteIcon from '@material-ui/icons/Delete';
import {ServiceContext} from '../Services/SeviceContext';
import Portal from './Portal';
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const getColorByIndex = (ind) => {
  // From https://sashat.me/2017/01/11/list-of-20-simple-distinct-colors/
  const COLORS = [
    '#e6194b',
    '#3cb44b',
    '#ffe119',
    '#4363d8',
    '#f58231',
    '#911eb4',
    '#46f0f0',
    '#f032e6',
    '#bcf60c',
    '#fabebe',
    '#008080',
    '#e6beff',
    '#9a6324',
    '#fffac8',
    '#800000',
    '#aaffc3',
    '#808000',
    '#ffd8b1',
    '#000075',
    '#808080',
    '#000000'];
  return COLORS[ind % COLORS.length];
};

const initRectSize = 100;

class TransformerComponent extends React.Component {
  componentDidMount() {
    this.checkNode();
  }

  componentDidUpdate() {
    this.checkNode();
  }

  checkNode() {
    const stage = this.transformer.getStage();
    const {selectedShapeName} = this.props;

    const selectedNode = stage.findOne('.' + selectedShapeName);
    if (selectedNode === this.transformer.node()) {
      return;
    }

    if (selectedNode) {
      this.transformer.attachTo(selectedNode);
    } else {
      this.transformer.detach();
    }
    this.transformer.getLayer().batchDraw();
  }

  render() {
    return (
      <Transformer
        rotateEnabled={false}
        keepRatio={false}
        ref={node => {
          this.transformer = node;
        }}
      />
    );
  }
}

class DrawingCanvas extends Component {
  state = {
    selectedRect: null,
    selectedTextAnnotations: [],
    selectedTextAnnotationsPrevIndexes: [],
    isDragging: false,
    originalX: 0,
    originalY: 0
  };
  static contextType = ServiceContext;

  async componentDidMount() {  
    if(this.props.publicationsService){
      var types = await this.props.publicationsService.getTypes();
      this.availableTypes = types;
    }
  }

  componentDidUpdate(prevProps) {
    var selected = [];
    if (this.props.annotations !== prevProps.annotations && !this.state.isDragging && this.state.selectedTextAnnotations && this.state.selectedTextAnnotations.length) {
      this.state.selectedTextAnnotationsPrevIndexes.forEach(index => selected.push(this.props.textAnnotations[index]));
      this.setState(
        {
          selectedTextAnnotations: selected
        }
      );
    }
    if(this.props.isAnnotationTextEditMode && this.props.isAnnotationTextEditMode !== prevProps.isAnnotationTextEditMode){
      var index = this.props.selectedAnnotations[0].annotationIndex;
      var subindex = this.props.selectedAnnotations[0].subRegionIndex;
      var subregion = this.props.annotations[index].subRegions[subindex];
      var indexes = [];
      subregion.subRegions.forEach((el) => {
        var index = this.props.textAnnotations.findIndex(text => Math.round(text.x1 * 1000)===Math.round(el.x1 * 1000) && Math.round(text.x2 * 1000)===Math.round(el.x2 * 1000) && Math.round(text.y1 * 1000)===Math.round(el.y1 * 1000) && Math.round(text.y2 * 1000)===Math.round(el.y2 * 1000));
        if(index>-1){
          indexes.push(index);
          selected.push(this.props.textAnnotations[index]);
        }
      });
      this.setState(
        {
          selectedTextAnnotations: selected,
          selectedTextAnnotationsPrevIndexes: indexes
        }
      );
    }
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  selectedRects() {
    return this.props.selectedAnnotations ? this.props.selectedAnnotations.map(
      ({annotationIndex, subRegionIndex}) => 
      subRegionIndex == null ? `rect${annotationIndex}` : `rect${annotationIndex}.${subRegionIndex}`) : [];
  }

  selectedTextAnnotations() {
    if(!this.props.selectedAnnotations)
      return [];
    var array = [];
    var annotations = this.props.selectedAnnotations;
    for(var i=0; i<annotations.length; i++){
      var index = annotations[i].annotationIndex;
      var subindex = annotations[i].subRegionIndex;
      if(subindex==null)
       continue;
      var subregion = this.props.annotations[index].subRegions[subindex];
      if(this.isTextAnnotation(subregion.type)){
        array.push(subregion);
      }
    }
    return array;
  }

  formatTypes(types) {
    if(!this.availableTypes){
      this.availableTypes = this.props.publicationsService.types;
    }
    var allTypes = this.availableTypes;
    if(!allTypes)
      return;
    this.availableTypes.forEach(type => {
      if(type.subtypes){
        allTypes = allTypes.concat(type.subtypes);
      }
    });
    return types.map(type => {
      var found = allTypes.find(({value}) => value === type);
      if(found)
       return found.name;
      return '';
    }).join(',');
  }

  isTextAnnotation(types) {
    if(!this.availableTypes)
      return false;
    var isTextAnnotation = null;
    for(var i=0; i<this.availableTypes.length; i++){
      var type = this.availableTypes[i];
      if(type.subtypes){
        for(var j=0; j<type.subtypes.length; j++){
          var subtype = type.subtypes[j];
          if(subtype.value === types[0]){
            isTextAnnotation = subtype.isTextAnnotation;
            break;
          }
        }
      }
      if(isTextAnnotation !== null)
        break;
    }
    return isTextAnnotation;
  }

  getScaledPointerPosition(stage) {
    var pointerPosition = stage.getPointerPosition();
    var stageAttrs = stage.attrs;
    var x = (pointerPosition.x - stageAttrs.x) / stageAttrs.scaleX;
    var y = (pointerPosition.y - stageAttrs.y) / stageAttrs.scaleY;
    return {x: x, y: y};
  }

  selectTextAnnotationOnClick = (event, x1, x2, y1, y2) => {
    if (((isMac && !event.metaKey) || (!isMac && !event.ctrlKey)) && !event.shiftKey)
      this.prevSelected = [];
    var selected = [];
    var indexes = [];
    var firstIndex = null;
    var secondIndex = null;
    var i;
    for(i=0; i<this.props.textAnnotations.length; i++){
      var el = this.props.textAnnotations[i];
      if(firstIndex === null && el.x1<x1 && el.x2>x1 && el.y1<y1 && el.y2>y1){
        firstIndex = i;
      }
      if(secondIndex === null && el.x1<x2 && el.x2>x2 && el.y1<y2 && el.y2>y2){
        secondIndex = i;
      }
      if(secondIndex !== null && firstIndex !== null)
        break;
    }
    if(firstIndex === null){
      var pointerPosition = this.getScaledPointerPosition(this.stage);
      this.setState({
        originalX: pointerPosition.x,
        originalY: pointerPosition.y
      });
      return;
    }
    if(secondIndex === null || firstIndex === null)
      return;
    var minIndex = Math.min(secondIndex, firstIndex);
    var maxIndex = Math.max(secondIndex, firstIndex);
    indexes = [];
    for(i = minIndex; i<=maxIndex; i++)
      indexes.push(i);
    if ((isMac && event.metaKey) || (!isMac && event.ctrlKey))
      indexes = indexes.concat(this.prevSelected.filter((item) => indexes.indexOf(item) < 0));
    else if(event.shiftKey)
      indexes = this.prevSelected.filter((item) => indexes.indexOf(item) < 0);
    selected = [];
    for(i = 0; i< indexes.length; i++)
      selected.push(this.props.textAnnotations[indexes[i]]);
    if(selected){
      this.setState(
        {
          selectedTextAnnotations: selected,
          selectedTextAnnotationsPrevIndexes: indexes
        }
      );
    }
  }

  handleMouseDown = (event) => {
    if(!this.props.isAnnotationTextMode)
      return;
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    if(!this.prevSelected){
      this.prevSelected=[];
    }
    this.stage = event.currentTarget.getStage();
    var pointerPosition = this.getScaledPointerPosition(this.stage);
    var x1 = pointerPosition.x;
    var x2 = x1;
    var y1 = pointerPosition.y;
    var y2 = y1;
    this.selectTextAnnotationOnClick(event.evt, x1, x2, y1, y2);
    this.setState({
      originalX: x1,
      originalY: y1,
      isDragging: true
    });
  };
  
  handleMouseMove = (event) => {
    const { isDragging } = this.state;

    if (!isDragging || !this.stage.getPointerPosition()) {
      return;
    }
    var pointerPosition = this.getScaledPointerPosition(this.stage);
    var x1, x2, y1, y2;
    x1 = this.state.originalX;
    x2 = pointerPosition.x;
    y1 = this.state.originalY;
    y2 = pointerPosition.y;
    this.selectTextAnnotationOnClick(event, x1, x2, y1, y2);
  };

  handleMouseUp = () => {
    const { isDragging } = this.state;

    if (!isDragging) {
      return;
    }
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.prevSelected = this.state.selectedTextAnnotationsPrevIndexes;
    this.setState(
      {
        isDragging: false
      }
    );
  };

  sortTextAnnotations = () => {
    var sorted = this.state.selectedTextAnnotations;
    var indexes = this.state.selectedTextAnnotationsPrevIndexes;
    var swapp;
    var n = indexes.length-1;
    do {
        swapp = false;
        for (var i=0; i < n; i++)
        {
            if (indexes[i] > indexes[i+1])
            {
               var temp = indexes[i];
               indexes[i] = indexes[i+1];
               indexes[i+1] = temp;
               temp = sorted[i];
               sorted[i] = sorted[i+1];
               sorted[i+1] = temp;
               swapp = true;
            }
        }
        n--;
    } while (swapp);
    return sorted;
  }
  
  saveTextAnnotation = () => {
    this.props.onSaveTextAnnotation(this.sortTextAnnotations());
    this.setState(
      {
        selectedTextAnnotations: [],
        selectedTextAnnotationsPrevIndexes: []
      }
    );
  }

  discardTextAnnotation = () => {
    this.props.onSaveTextAnnotation([]);
    this.setState(
      {
        selectedTextAnnotations: []
      }
    );
  }

  render() {
    return (
      <Layer onMouseDown={this.handleMouseDown}>
        <Image image={this.props.image} perfectDrawEnabled={false}/>
        {this.props.annotations && this.props.annotations
        .map(
          ({x1, y1, type, subRegions}, ind) => 
                    <React.Fragment key={ind}>
                      {type && type.length > 0 && <Text x={x1+5} y={y1+5} text={this.formatTypes(type)} fill={getColorByIndex(ind)} />}
                      {subRegions && subRegions.map(({x1, y1, type}, ind2) =>
                        {
                          if(type && type.length > 0){
                            if(!this.isTextAnnotation(type))
                              return <Text key={ind2} x={x1+5} y={y1+5} text={this.formatTypes(type)} fill={getColorByIndex(ind)}/> ;
                            return <Text key={ind2} x={x1-2} y={y1-12} text={this.formatTypes(type)} fill={getColorByIndex(ind)}/> ;  
                          }
                        }
                      )}
                    </React.Fragment>
        )}
        {this.props.annotations && this.props.annotations.map(({x1, y1, x2, y2, type, subRegions}, ind) =>
          <React.Fragment key={ind}>
            <Rect onClick={(evt) => this.props.changeAnnotationIndex(ind, null, evt)}
                  onDblClick={() => this.props.showModal(ind)}
                  x={x1} y={y1} width={initRectSize} height={initRectSize} scaleX={(x2 - x1) / initRectSize}
                  scaleY={(y2 - y1) / initRectSize}
                  draggable={!this.props.isAnnotationTextMode}
                  onDragEnd={(args) => this.props.onAnnotationMove(args, ind, null)}
                  onTransformEnd={(args) => this.props.onAnnotationTransform(args, ind, null)}
                  stroke={getColorByIndex(ind)}
                  strokeScaleEnabled={false}
                  name={`rect${ind}`}
                  perfectDrawEnabled={false}
            />
            {subRegions && subRegions.map(({x1, y1, x2, y2, type, subRegions}, ind2) =>
                {
                  if(this.isTextAnnotation(type)){
                    return <React.Fragment key={ind2}>
                              {subRegions && subRegions.map(({x1, y1, x2, y2}, ind3) =>
                                    <Rect x={x1} y={y1} width={initRectSize} height={initRectSize} 
                                    onClick={(evt) => this.props.changeAnnotationIndex(ind, ind2, evt)}
                                    scaleX={(x2 - x1) / initRectSize}
                                    scaleY={(y2 - y1) / initRectSize}
                                    stroke={getColorByIndex(ind)}
                                    strokeScaleEnabled={false}
                                    name={`text${ind2}.${ind3}`}
                                    key={`${ind2}.${ind3}`}
                                    perfectDrawEnabled={false} />)
                              }
                          </React.Fragment>;
                  }
                  return <Rect onClick={(evt) => this.props.changeAnnotationIndex(ind, ind2, evt)}
                      x={x1} y={y1} width={initRectSize} height={initRectSize} scaleX={(x2 - x1) / initRectSize}
                      scaleY={(y2 - y1) / initRectSize}
                      draggable
                      onDragEnd={(args) => this.props.onAnnotationMove(args, ind, ind2)}
                      onTransformEnd={(args) => this.props.onAnnotationTransform(args, ind, ind2)}
                      stroke={getColorByIndex(ind)}
                      strokeScaleEnabled={false}
                      name={`rect${ind}.${ind2}`}
                      key={`${ind}.${ind2}`}
                      perfectDrawEnabled={false}
                />}
                )}
          </React.Fragment>
        )}
        {this.selectedRects().map((rectName) => <TransformerComponent key={rectName} selectedShapeName={rectName}/>)}
        {this.selectedTextAnnotations().map(({subRegions}, ind2) =>
                {
                    return <React.Fragment key={ind2}>
                              {subRegions && subRegions.map(({x1, y1, x2, y2}, ind3) =>
                                    <Rect x={x1-2} y={y1-2} width={initRectSize+2} height={initRectSize+4} 
                                    scaleX={(x2 - x1 +2) / initRectSize}
                                    scaleY={(y2 - y1 +3) / initRectSize}
                                    stroke={'#63A2F5'}
                                    strokeScaleEnabled={false}
                                    key={`${ind2}.${ind3}`}
                                    perfectDrawEnabled={false} />)
                              }
                          </React.Fragment>;
                })}
        {this.props.isAnnotationTextMode && this.state.selectedTextAnnotations && 
          this.state.selectedTextAnnotations.map(
              ({x1, y1, x2, y2}, ind) => 
                            <Rect x={x1} y={y1} width={initRectSize} height={initRectSize} 
                                  scaleX={(x2 - x1) / initRectSize}
                                  scaleY={(y2 - y1) / initRectSize}
                                  stroke='#6262e5'
                                  strokeScaleEnabled={false}
                                  name={`text${ind}`}
                                  key={ind} 
                                  perfectDrawEnabled={false}
                            />
            )}
          {this.props.isAnnotationTextMode && 
          <Portal>
            <Fab size="small" className='save-fab' color='primary' onClick={this.saveTextAnnotation}>
                <Check/>
            </Fab>
            <Fab size="small" className='discard-fab' color='secondary' onClick={this.discardTextAnnotation}>
                <DeleteIcon />
            </Fab>
        </Portal>}
      </Layer>
    );
  }
}

export default DrawingCanvas;
