import React from 'react';
import autoBind from 'auto-bind';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCheck, faBan, faArrowRight, faTimes, faFolderPlus, faFolder} from '@fortawesome/free-solid-svg-icons'
import { defer } from 'lodash';
import ContentEditable from './content-editable';
import ContextMenu from './context-menu';

export default class Row extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      editing: false,
      topic: null,
      input: null,
      output: null,
      label: null,
      labler: null,
      topic_name: null,
      scores: null,
      dragging: false,
      dropHighlighted: 0,
      hovering: false,
      plusHovering: false
    };

    this.dataLoadActions = [];

    this.props.comm.subscribe(this.props.id, this.dataLoaded);

    window["row_"+this.props.id] = this;
    window.faTimes = faTimes;
  }

  dataLoaded(state) {
    if (state == undefined) return;

    if (this.dataLoadActions.length > 0) {
      for (let i = 0; i < this.dataLoadActions.length; i++) {
        this.dataLoadActions[i]();
      }
      this.dataLoadActions = [];
    }
    // console.log("state.topic_name", state.topic_name)
    // we automatically start editing topics that are selected and have an imputed name
    if (state.topic_name && (state.topic_name.startsWith("New topic") || state.value1 === "New test") && this.props.soleSelected) {
      state["editing"] = true;
      console.log("setting editing state to true!")
    }
    
    this.setState(state);
  }

  UNSAFE_componentWillUpdate(nextProps, nextState) {

    // if we are becoming to sole selected item then we should scroll to be viewable after rendering
    if (!this.props.soleSelected && nextProps.soleSelected) {
      this.scrollToView = true;
    }

    // we need to force a relayout if the type changed since that impacts global alignments
    if (this.state.type !== nextState.type) {
      if (this.props.forceRelayout) this.props.forceRelayout();
    }
  }

  componentDidUpdate() {
    this.componentDidUpdateOrMount(false);
  }

  componentDidMount() {
    this.componentDidUpdateOrMount(true);
  }
  
  componentDidUpdateOrMount(mount) {
    // update any listeners for score totals
    if (this.props.scoreColumns) {
      for (const k of this.props.scoreColumns) {
        if (this.state.scores && this.props.updateTotals) {
          // console.log("this.props.updateTotals", k, this.state.scores[k])
          this.props.updateTotals(k,
            this.state.scores[k].reduce((total, value) => total + (value[1] <= 0), 0),
            this.state.scores[k].reduce((total, value) => total + (value[1] > 0), 0)
          );
        }
      }
    }

    // see if we should scroll to make ourselves visible
    if (this.scrollToView) {
      console.log("scrollingtoView!");
      if (this.divRef) {
        this.divRef.focus();
        scrollParentToChild(this.props.scrollParent, this.divRef);
        this.scrollToView = false;
      }
    }
  }

  render() {
    // console.log("---- render Row ----");
    if (this.state.label === null) return null; // only render if we have data
    // console.log("real render Row");

    const main_score = this.props.scoreColumns ? this.props.scoreColumns[0] : undefined;
    // console.log("rendering row", this.props)
    // apply the value1/value2/topic filters
    if (this.state.topic_name === null) {
      if (this.props.value1Filter && this.state.value1 !== "") {
        const re = RegExp(this.props.value1Filter);
        if (!re.test(this.state.value1)) return null;
      }
      if (this.props.comparatorFilter) {
        const re = RegExp(this.props.comparatorFilter);
        if (!re.test(this.state.comparator)) {
          if (this.state.value1 === "") { // we are the blank suggestion
            for (const c of ["should not be", "should be", "should be the same as for", "should be invertable."]) {
              if (re.test(c)) {
                this.setState({comparator: c});
                return null;
                break
              }
            }
          } else return null;
        }
      }
      if (this.props.value2Filter && this.state.value1 !== "") {
        const re = RegExp(this.props.value2Filter);
        if (!re.test(this.state.value2) && !re.test(this.state.value1) && !re.test(this.state.comparator)) return null;
      }

    } else if (this.props.value2Filter) {
      const re = RegExp(this.props.value2Filter); // TODO: rename value2Filter to reflect it's global nature
      if (!re.test(this.state.topic_name)) return null;
    }
    // console.log("real render Row2");


    // extract the raw model outputs as strings for tooltips
    let model_output_strings = {};
    for (const val of ["value1", "value2", "value3"]) {
      model_output_strings[val] = [];
      const val_outputs = this.state[val+"_outputs"] || [];
      for (const k in val_outputs) {
        if (val_outputs[k] && val_outputs[k].length == 1) {
          const d = val_outputs[k][0][1];
          let str = k.slice(0, -6) + " outputs for " + val + ": \n";
          for (const name in d) {
            if (name === "string") {
              str += d[name] + "\n";
            } else {
              if (typeof d[name] === 'string') {
                str += name + ": " + "|".join(d[name].split("|").map(x => "" + parseFloat(x).toFixed(3)));
              } else {
                str += name + ": " + d[name].toFixed(3) + "\n";
              }
            }
          }
          model_output_strings[val].push(str);
        }
      }
      model_output_strings[val] = model_output_strings[val].join("\n");
    }
    

    let outerClasses = "adatest-row-child";
    if (this.props.selected) outerClasses += " adatest-row-selected";
    if (this.state.dropHighlighted) outerClasses += " adatest-row-drop-highlighted";
    if (this.state.dragging) outerClasses += " adatest-row-dragging";
    if (this.props.isSuggestion && this.state.plusHovering) outerClasses += " adatest-row-hover-highlighted";
    //if (this.state.hidden) outerClasses += " adatest-row-hidden";

    let hideClasses = "adatest-row-hide-button";
    if (this.state.hovering) hideClasses += " adatest-row-hide-hovering";
    if (this.state.hidden) hideClasses += " adatest-row-hide-hidden";

    let addTopicClasses = "adatest-row-hide-button";
    if (this.state.hovering) addTopicClasses += " adatest-row-hide-hovering";

    let editRowClasses = "adatest-row-hide-button";
    if (this.state.hovering) editRowClasses += " adatest-row-hide-hovering";
    if (this.state.editing) editRowClasses += " adatest-row-hide-hidden";

    // const test_type_parts = this.props.test_type_parts[this.state.type];
    
    let overall_score = {};
    if (this.state.scores) {
      for (let k in this.state.scores) {
        const arr = this.state.scores[k].filter(x => Number.isFinite(x[1])).map(x => x[1])
        overall_score[k] = arr.reduce((a, b) => a + b, 0) / arr.length;
      }
    } else {
      for (let k in this.state.scores) {
        overall_score[k] = NaN;
      }
    }

    // console.log("overall_score", overall_score);

    // var hack_score = overall_score[this.props.scoreColumns[0]];
    // var hack_output_flip = {
    //   "todo": "not todo",
    //   "not todo": "todo"
    // }
    // console.log("asdfa", main_score, this.state["value1_outputs"]);
    // if (this.state["value1_outputs"]) {
    //   var tmp = this.state["value1_outputs"][main_score][0][1];
    //   console.log("heresss65", this.state["value1_outputs"], Object.keys(tmp));
    //   var hack_output_name = Object.keys(tmp).reduce((a, b) => tmp[a] > tmp[b] ? a : b);
    // }
    var label_opacity = this.state.labeler === "imputed" ? 0.5 : 1;

    // get the display parts for the template instantiation with the highest score
    const display_parts = this.state.display_parts ? this.state.display_parts[this.state.max_score_ind] : {};

    // console.log("overall_score[main_score]", overall_score[main_score], this.props.score_filter)
    if (this.props.scoreFilter && overall_score[main_score] < this.props.scoreFilter && this.props.scoreFiler > -1000) {
      //console.log("score filter ", this.state.value1, score, this.props.scoreFilter)
      return null;
    }
    // console.log("real render Row3");

    return <div className={outerClasses} draggable onMouseOver={this.onMouseOver} onMouseOut={this.onMouseOut} onMouseDown={this.onMouseDown}
                onDragStart={this.onDragStart} onDragEnd={this.onDragEnd} onDragOver={this.onDragOver}
                onDragEnter={this.onDragEnter} onDragLeave={this.onDragLeave} onDrop={this.onDrop} ref={(el) => this.divRef = el}
                style={this.props.hideBorder ? {} : {borderTop: "1px solid rgb(216, 222, 228)"}} tabIndex="0" onKeyDown={this.keyDownHandler}>
      <ContextMenu top={this.state.contextTop} left={this.state.contextLeft} open={this.state.contextOpen}
                    onClose={this.closeContextMenu} rows={this.state.contextRows} onClick={this.handleContextMenuClick} />
      {this.state.topic_name !== null && !this.props.isSuggestion &&
        <div onClick={this.onOpen} className="adatest-row-add-button" style={{marginLeft: "6px", lineHeight: "14px", opacity: "1", cursor: "pointer", paddingLeft: "4px", marginRight: "3px", paddingRight: "0px", display: "inline-block"}}>
          <FontAwesomeIcon icon={faFolder} style={{fontSize: "14px", color: "rgb(84, 174, 255)", display: "inline-block"}} />
        </div>
      }
      {this.props.isSuggestion && this.state.topic_name !== null &&
        <div onClick={this.addToCurrentTopic} className="adatest-row-add-button adatest-hover-opacity" style={{cursor: "pointer"}} onMouseOver={this.onPlusMouseOver} onMouseOut={this.onPlusMouseOut}>
          <FontAwesomeIcon icon={faFolderPlus} style={{fontSize: "14px", color: "#000000", display: "inline-block"}} title="Add to current topic" />
        </div>
      }
      {/* {this.state.topic_name === null &&
        <svg height="20" width="50" style={{marginTop: "5px", flex: "0 0 50px", display: "inline-block", marginLeft: "8px"}}>
          <FontAwesomeIcon icon={faTimes} height="15px" y="3px" x="15px" style={{color: "rgb(0, 0, 0)", cursor: "pointer"}} textAnchor="middle" />
          <FontAwesomeIcon icon={faCheck} height="15px" y="3px" x="-15px" style={{color: "rgba(0, 0, 0, 0.05)", cursor: "pointer"}} textAnchor="middle" />
        </svg>
      } */}
      
      <div style={{padding: "5px", flex: 1}} onClick={this.clickRow} onDoubleClick={this.onOpen}>  
        {this.state.topic_name !== null ? <React.Fragment>
          <div style={{display: "flex", marginTop: "3px", fontSize: "14px"}}> 
            <div className={this.state.hidden ? "adatest-row-hidden": ""} style={{flex: "1", textAlign: "left"}}>
              <ContentEditable onClick={this.clickTopicName} ref={el => this.topicNameEditable = el} text={this.state.topic_name} onInput={this.inputTopicName} onFinish={this.finishTopicName} editable={this.state.editing} />
            </div>
          </div>
          <div className="adatest-row" style={{opacity: 0.6, marginTop: "-16px", display: this.state.previewValue1 ? 'flex' : 'none'}}>
            {/* <div style={{flex: "0 0 140px", textAlign: "left"}}>
              <span style={{color: "#aaa"}}>{this.state.prefix}</span>
            </div> */}
            <div className="adatest-row-input">
              <span style={{color: "#aaa", opacity: this.state.hovering ? 1 : 0, transition: "opacity 1s"}}>{this.state.prefix}</span><span style={{color: "#aaa"}}>"</span>{this.state.previewValue1}<span style={{color: "#aaa"}}>"</span>
            </div>
            <div style={{flex: "0 0 25px", color: "#999999", textAlign: "center", overflow: "hidden", opacity: (this.state.previewValue1 ? 1 : 0)}}>
              <div style={{lineHeight: "13px", height: "16px", opacity: "1.0", verticalAlign: "middle", display: "inline-block"}}>
                <span style={{color: "#aaa"}}>should not be</span> {/* TODO: fix this for varying comparators */}
              </div>
            </div>
            <div style={{flex: "0 0 150px", textAlign: "left"}}>
            <span style={{color: "#aaa"}}>"</span>{this.state.previewValue2}<span style={{color: "#aaa"}}>"</span>
            </div>
          </div>
          
          </React.Fragment> : (
          <div className="adatest-row">
            <div className="adatest-row-input" onClick={this.clickRow}>
              <div onClick={this.clickInput} style={{display: "inline-block"}}>
                <span style={{width: "0px"}}></span>
                <span title={model_output_strings["value1"]} onContextMenu={this.handleInputContextMenu}>
                  <ContentEditable onClick={this.clickInput} onTemplateExpand={this.templateExpandValue1} ref={el => this.inputEditable = el} text={this.state.input} onInput={this.inputInput} onFinish={this.finishInput} editable={this.state.editing} defaultText={this.props.value1Default} />
                </span>
                <span style={{width: "0px"}}></span>
              </div>
            </div>
            <div style={{flex: "0 0 25px", color: "#999999", textAlign: "center", overflow: "hidden", display: "flex"}}>
              <div style={{alignSelf: "flex-end", display: "inline-block"}}>
                <FontAwesomeIcon icon={faArrowRight} style={{fontSize: "14px", color: "#999999", display: "inline-block", marginLeft: "5px"}} textAnchor="left" />
              </div>
            </div>
            <div onClick={this.clickOutput} style={{maxWidth: "400px", overflowWrap: "anywhere", flex: "0 0 150px", textAlign: "left", display: "flex"}}>
              <span style={{alignSelf: "flex-end"}}>
                <span style={{width: "0px"}}></span>
                <span title={model_output_strings["value2"]} style={{opacity: Number.isFinite(overall_score[main_score]) ? 1 : 0.5}}>
                  <ContentEditable ref={el => this.value2Editable = el} onClick={this.clickOutput} text={this.state.output} onInput={this.inputOutput} onFinish={_ => this.setState({editing: false})} editable={this.state.editing} defaultText={this.props.outputDefault} />
                </span>
                <span style={{width: "0px"}}></span>
              </span>
            </div>
          </div>
        )}
      </div>
      {/* <div className="adatest-row-score-text-box">
        {this.state.topic_name === null && !isNaN(score) && score.toFixed(3).replace(/\.?0*$/, '')}
      </div> */}
      {this.state.topic_name === null &&
        <svg height="30" width="90" style={{marginTop: "0px", flex: "0 0 90px", textAling: "left", display: "inline-block", marginLeft: "8px", marginRight: "0px"}}>
          {this.state.labeler === "imputed" && this.state.label === "pass" ?
            <FontAwesomeIcon icon={faCheck} strokeWidth="50px" style={{color: "rgba(0, 0, 0, 0.05)"}} stroke={this.state.label === "pass" ? "rgb(26, 127, 55)" : "rgba(0, 0, 0, 0.05)"} height="15px" y="8px" x="-30px" textAnchor="middle" />
          :
            <FontAwesomeIcon icon={faCheck} height="17px" y="7px" x="-30px" style={{color: this.state.label === "pass" ? "rgb(26, 127, 55)" : "rgba(0, 0, 0, 0.05)", cursor: "pointer"}} textAnchor="middle" />
          }
          {this.state.labeler === "imputed" && this.state.label === "fail" ?
            <FontAwesomeIcon icon={faTimes} strokeWidth="50px" style={{color: "rgba(0, 0, 0, 0.05)"}} stroke={this.state.label === "fail" ? "rgb(207, 34, 46)" : "rgba(0, 0, 0, 0.05)"} height="15px" y="8px" x="0px" textAnchor="middle" />
          :
            <FontAwesomeIcon icon={faTimes} stroke="" height="17px" y="7px" x="0px" style={{color: this.state.label === "fail" ? "rgb(207, 34, 46,"+label_opacity+")" : "rgba(0, 0, 0, 0.05)", cursor: "pointer"}} textAnchor="middle" />
          }
          {this.props.isSuggestion ?
            <FontAwesomeIcon icon={faBan} height="17px" y="7px" x="30px" style={{color: this.state.label === "off_topic" ? "rgb(0, 0, 0)" : "rgba(0, 0, 0, 0.05)", cursor: "pointer"}} textAnchor="middle" />
          :
            <span style={{width: "31px", display: "inline-block"}}></span>
          }
          <line x1="0" y1="15" x2="30" y2="15" style={{stroke: "rgba(0, 0, 0, 0)", strokeWidth: "30", cursor: "pointer"}} onClick={this.labelAsPass}></line>
          <line x1="30" y1="15" x2="60" y2="15" style={{stroke: "rgba(0, 0, 0, 0)", strokeWidth: "30", cursor: "pointer"}} onClick={this.labelAsFail}></line>
          <line x1="60" y1="15" x2="90" y2="15" style={{stroke: "rgba(0, 0, 0, 0)", strokeWidth: "30", cursor: "pointer"}} onClick={this.labelAsOffTopic}></line>
        </svg>
      }
      {this.props.scoreColumns && this.props.scoreColumns.map(k => {

        let total_pass = 0;
        if (this.state.topic_name !== null) {
          total_pass = this.state.scores[k].reduce((total, value) => total + (value[1] <= 0), 0);
        }
        let total_fail = 0;
        if (this.state.topic_name !== null) {
          total_fail = this.state.scores[k].reduce((total, value) => total + (value[1] > 0), 0);
        }
        
        // this.totalPasses[k] = Number.isFinite(overall_score[k]) ? this.state.scores[k].reduce((total, value) => total + (value[1] <= 0), 0) : NaN;
        // this.totalFailures[k] = this.state.scores[k].reduce((total, value) => total + (value[1] > 0), 0);
        return <div key={k} className="adatest-row-score-plot-box">
          {overall_score[k] > 0 ?
            <svg height="20" width="100">
              {Number.isFinite(overall_score[k]) && <React.Fragment>
                <line x1="50" y1="10" x2={50 + 48*scale_score(overall_score[k])} y2="10" style={{stroke: "rgba(207, 34, 46, 0.15)", strokeWidth: "20"}}></line>
                <line x1={50} y1="0"
                      x2={50} y2="20"
                      style={{stroke: "rgb(207, 34, 46)", strokeWidth: "3"}}
                ></line>
                <polygon points="51,0 55,10 51,20" fill="rgb(207, 34, 46)" stroke="none"></polygon>
                {/* {this.state.topic_name !== null && 
                  <text x="25" y="11" dominantBaseline="middle" textAnchor="middle" style={{transition: "fill-opacity 1s, stroke-opacity 1s", strokeOpacity: this.state.hovering*1, fillOpacity: this.state.hovering*1, pointerEvents: "none", fill: "#ffffff", fontSize: "11px", strokeWidth: "3px", stroke: "rgb(26, 127, 55)", opacity: 1, strokeLinecap: "butt", strokeLinejoin: "miter", paintOrder: "stroke fill"}}>{this.state.scores[k].reduce((total, value) => total + (value[1] <= 0), 0)}</text>
                }
                {this.state.topic_name !== null &&
                  <text x="75" y="11" dominantBaseline="middle" textAnchor="middle" style={{transition: "fill-opacity 1s, stroke-opacity 1s", strokeOpacity: this.state.hovering*1, fillOpacity: this.state.hovering*1, pointerEvents: "none", fill: "#ffffff", fontSize: "11px", strokeWidth: "3px", stroke: "rgb(207, 34, 46)", opacity: 1, strokeLinecap: "butt", strokeLinejoin: "miter", paintOrder: "stroke fill"}}>{this.state.scores[k].reduce((total, value) => total + (value[1] > 0), 0)}</text>
                } */}
                {this.state.topic_name !== null && total_pass > 0 &&
                  <text x="25" y="11" dominantBaseline="middle" textAnchor="middle" style={{pointerEvents: "none", fill: "rgb(26, 127, 55)", fontWeight: "normal", fontSize: "14px"}}>{total_pass}</text>
                }
                {this.state.topic_name !== null && total_fail > 0 &&
                  <text x="75" y="11" dominantBaseline="middle" textAnchor="middle" style={{pointerEvents: "none", fill: "rgb(207, 34, 46)", fontWeight: "normal", fontSize: "14px"}}>{total_fail}</text>
                }
                {/* {this.state.topic_name === null &&
                  <text x="75" y="11" dominantBaseline="middle" textAnchor="middle" style={{transition: "fill-opacity 1s, stroke-opacity 1s", strokeOpacity: this.state.hovering*1, fillOpacity: this.state.hovering*1, pointerEvents: "none", fill: "#ffffff", fontSize: "11px", strokeWidth: "3px", stroke: "rgb(207, 34, 46)", opacity: 1, strokeLinecap: "butt", strokeLinejoin: "miter", paintOrder: "stroke fill"}}>{overall_score[k].toFixed(3).replace(/\.?0*$/, '')}</text>
                } */}
                {/* {this.state.topic_name === null &&
                  <text x="75" y="11" dominantBaseline="middle" textAnchor="middle" style={{transition: "fill-opacity 1s", fillOpacity: this.state.hovering*1, pointerEvents: "none", fill: "rgb(207, 34, 46)", fontSize: "11px", opacity: 1}}>{overall_score[k].toFixed(3).replace(/\.?0*$/, '')}</text>
                } */}
                {/* {this.state.topic_name === null &&
                  <FontAwesomeIcon icon={faTimes} height="15px" y="3px" x="25px" style={{color: "rgba(207, 34, 46,"+(this.props.isSuggestion ? 0.5 : 1)+")", cursor: "pointer"}} textAnchor="middle" />
                }
                {this.state.topic_name === null &&
                  <FontAwesomeIcon icon={faCheck} height="15px" y="3px" x="-25px" style={{color: "rgba(0, 0, 0, 0.05)", cursor: "pointer"}} textAnchor="middle" />
                } */}
                {/* {
                  <path class="fa" fill="rgb(207, 34, 46)" d={faTimes.icon[4]} />
                } */}
                {this.state.topic_name === 3324 && !isNaN(overall_score[k]) &&
                  <text x={(48*scale_score(overall_score[k]) > 3000 ? 50 + 5 : 50 + 48*scale_score(overall_score[k]) + 5)} y="11" dominantBaseline="middle" textAnchor="start" style={{pointerEvents: "none", fontSize: "11px", opacity: 0.7, fill: "rgb(207, 34, 46)"}}>{overall_score[k].toFixed(3).replace(/\.?0*$/, '')}</text>
                }
              </React.Fragment>}
            </svg>
          :
            <svg height="20" width="100">
              {Number.isFinite(overall_score[k]) && <React.Fragment>
                <line x2="50" y1="10" x1={50 + 48*scale_score(overall_score[k])} y2="10" style={{stroke: "rgba(26, 127, 55, 0.15)", strokeWidth: "20"}}></line>
                {/* {this.state.scores[k].filter(x => Number.isFinite(x[1])).map((score, index) => {
                  return <line key={index} onMouseOver={e => this.onScoreOver(e, score[0])}
                              onMouseOut={e => this.onScoreOut(e, score[0])}
                              x1={50 + 48*scale_score(score[1])} y1="0"
                              x2={50 + 48*scale_score(score[1])} y2="20"
                              style={{stroke: score[1] <= 0 ? "rgb(26, 127, 55)" : "rgb(207, 34, 46)", strokeWidth: "2"}}
                        ></line>
                })} */}
                <line x1={50} y1="0"
                      x2={50} y2="20"
                      style={{stroke: "rgb(26, 127, 55)", strokeWidth: "3"}}
                ></line>
                <polygon points="49,0 45,10 49,20" fill="rgb(26, 127, 55)" stroke="none"></polygon>
                {/* {this.state.topic_name !== null &&
                  <text x="25" y="11" dominantBaseline="middle" textAnchor="middle" style={{transition: "fill-opacity 1s, stroke-opacity 1s", strokeOpacity: this.state.hovering*1, fillOpacity: this.state.hovering*1, pointerEvents: "none", fill: "#ffffff", fontSize: "11px", strokeWidth: "3px", stroke: "rgb(26, 127, 55)", opacity: 1, strokeLinecap: "butt", strokeLinejoin: "miter", paintOrder: "stroke fill"}}>{this.state.scores[k].reduce((total, value) => total + (value[1] <= 0), 0)}</text>
                }
                {this.state.topic_name !== null &&
                  <text x="75" y="11" dominantBaseline="middle" textAnchor="middle" style={{transition: "fill-opacity 1s, stroke-opacity 1s", strokeOpacity: this.state.hovering*1, fillOpacity: this.state.hovering*1, pointerEvents: "none", fill: "#ffffff", fontSize: "11px", strokeWidth: "3px", stroke: "rgb(207, 34, 46)", opacity: 1, strokeLinecap: "butt", strokeLinejoin: "miter", paintOrder: "stroke fill"}}>{this.state.scores[k].reduce((total, value) => total + (value[1] > 0), 0)}</text>
                } */}
                {this.state.topic_name !== null && total_pass > 0 &&
                  <text x="25" y="11" dominantBaseline="middle" textAnchor="middle" style={{pointerEvents: "none", fill: "rgb(26, 127, 55)", fontWeight: "normal", fontSize: "14px"}}>{total_pass}</text>
                }
                {this.state.topic_name !== null && total_fail > 0 &&
                  <text x="75" y="11" dominantBaseline="middle" textAnchor="middle" style={{pointerEvents: "none", fill: "rgb(207, 34, 46)", fontWeight: "normal", fontSize: "14px"}}>{total_fail}</text>
                }
                {/* {this.state.topic_name === null &&
                  <text x="25" y="11" dominantBaseline="middle" textAnchor="middle" style={{transition: "fill-opacity 1s, stroke-opacity 1s", strokeOpacity: this.state.hovering*1, fillOpacity: this.state.hovering*1, pointerEvents: "none", fill: "#ffffff", fontSize: "11px", strokeWidth: "3px", stroke: "rgb(26, 127, 55)", opacity: 1, strokeLinecap: "butt", strokeLinejoin: "miter", paintOrder: "stroke fill"}}>{overall_score[k].toFixed(3).replace(/\.?0*$/, '')}</text>
                } */}
                {/* {this.state.topic_name === null &&
                  <FontAwesomeIcon icon={faTimes} height="15px" y="3px" x="25px" style={{color: "rgb(0, 0, 0, 0.05)", cursor: "pointer"}} textAnchor="middle" />
                }
                {this.state.topic_name === null &&
                  <FontAwesomeIcon icon={faCheck} height="15px" y="3px" x="-25px" style={{color: "rgb(26, 127, 55)", cursor: "pointer"}} textAnchor="middle" />
                } */}
                {this.state.topic_name === 2342 && !isNaN(overall_score[k]) &&
                  <text x={(48*scale_score(overall_score[k]) < -3000 ? 50 - 5 : 50 + 48*scale_score(overall_score[k]) - 5)} y="11" dominantBaseline="middle" textAnchor="end" style={{pointerEvents: "none", fontSize: "11px", opacity: 0.7, fill: "rgb(26, 127, 55)"}}>{overall_score[k].toFixed(3).replace(/\.?0*$/, '')}</text>
                }
              </React.Fragment>}
            </svg>
          }
        </div>
      })}
    </div>
  }

  onMouseDown(e) {
    this.mouseDownTarget = e.target;
  }

  handleContextMenuClick(row) {
    console.log("handleContextMenuClick", row)
    if (row === "Expand into a template") {
      console.log("EXPAND!!", this.props.id, this.state.contextFocus);
      if (this.state.contextFocus === "value1") {
        this.props.comm.send(this.props.id, {"action": "template_expand_value1"});
      }
    }
    this.setState({contextOpen: false});
  }

  closeContextMenu() {
    this.setState({contextOpen: false});
  }

  handleInputContextMenu(e) {
    e.preventDefault();
    console.log("handleInputContextMenu open", e, e.pageY, e.pageX)
    this.setState({contextTop: e.pageY, contextLeft: e.pageX, contextOpen: true, contextFocus: "value1", contextRows: ["Expand into a template"]});
  }

  templateExpandValue1() {
    console.log("templateExpandValue1")
    this.props.comm.send(this.props.id, {"action": "template_expand_value1"});
  }

  keyDownHandler(e) {
    if (e.keyCode == 13) {
      console.log("return!", this.props.soleSelected, this.props.selected)
      if (this.props.soleSelected) {
        if (this.state.topic_name !== null) {
          this.onOpen(e);
        } else if (this.props.isSuggestion) {
          this.addToCurrentTopic(e);
          this.doOnNextDataLoad(() => this.props.giveUpSelection(this.props.id));
        }
      }
    }
  }

  doOnNextDataLoad(f) {
    this.dataLoadActions.push(f);
  }

  changeTestType(e) {
    this.props.comm.send(this.props.id, {"type": e.target.value});
    this.setState({type: e.target.value});
  }

  labelAsFail(e) {
    this.props.comm.send(this.props.id, {"label": "fail", "labeler": this.props.user});
    if (this.props.isSuggestion) {
      this.props.comm.send(this.props.id, {"topic": this.props.topic});
    }
    this.setState({label: "fail"});
  }

  labelAsOffTopic(e) {
    this.props.comm.send(this.props.id, {"topic": "_DELETE_"});
    this.setState({label: "off_topic"});
  }

  labelAsPass(e) {
    this.props.comm.send(this.props.id, {"label": "pass", "labeler": this.props.user});
    if (this.props.isSuggestion) {
      this.props.comm.send(this.props.id, {"topic": this.props.topic});
    }
    this.setState({label: "pass"});
  }

  onScoreOver(e, key) {
    this.setState({
      previewValue1: this.props.comm.data[key].value1,
      previewValue2: this.props.comm.data[key].value2
    })
  }
  onScoreOut(e, key) {
    this.setState({
      previewValue1: null,
      previewValue2: null
    })
  }

  toggleEditRow(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!this.state.editing) {
      this.setState({editing: true});
      console.log("about to edit focus")
      if (this.state.topic_name === null) {
        defer(() => this.inputEditable.focus());
      } else {
        defer(() => this.topicNameEditable.focus());
      }
    } else {
      this.setState({editing: false});
    }
  }

  toggleHideTopic(e) {
    e.preventDefault();
    e.stopPropagation();

    this.props.comm.send(this.props.id, {"hidden": !this.state.hidden});
  }

  /* addNewTopic(e) {
    e.preventDefault();
    e.stopPropagation();
    const newName = this.props.generateTopicName();
    const newTopic = this.props.topic + "/" + newName;
    if (this.state.topic_name === null) {
      this.props.comm.send(this.props.id, {"topic": newTopic });
    } else {
      this.props.comm.send(this.props.id, {"topic": newTopic + "/" + this.state.topic_name});
    }
    this.props.setSelected(newTopic);
  } */

  onMouseOver(e) {
    //console.log("onMouseOver")
    //e.preventDefault();
    //e.stopPropagation();
    this.setState({hovering: true});
  }
  onMouseOut(e) {
    //e.preventDefault();
    //e.stopPropagation();
    this.setState({hovering: false});
  }

  onPlusMouseOver(e) {
    //console.log("onPlusMouseOver")
    //e.preventDefault();
    //e.stopPropagation();
    this.setState({plusHovering: true});
  }
  onPlusMouseOut(e) {
    //e.preventDefault();
    //e.stopPropagation();
    this.setState({plusHovering: false});
  }

  onOpen(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Row.onOpen(", e, ")");
    if (this.state.topic_name !== null && this.props.onOpen) {
      this.props.onOpen(this.props.topic + "/" + this.state.topic_name);
    }
  }

  inputInput(text) {
    console.log("inputInput", text)
    this.setState({input: text, scores: null});
    this.props.comm.debouncedSend500(this.props.id, {input: text});
  }

  finishInput(text) {
    console.log("finishInput", text)
    this.setState({editing: false});
    if (text.includes("/")) {
      this.setState({input: text, scores: null});
      this.props.comm.send(this.props.id, {input: text});
    }
  }

  inputOutput(text) {
    console.log("inputOutput", text);
    text = text.trim();
    this.setState({output: text, scores: null});
    this.props.comm.debouncedSend500(this.props.id, {output: text});

    // if (this.props.value2Edited) {
    //   this.props.value2Edited(this.props.id, this.state.value2, text);
    // }
    // this.setValue2(text);
  }

  setValue2(text) {
    this.setState({value2: text, scores: null});
    this.props.comm.debouncedSend500(this.props.id, {value2: text});
  }

  inputTopicName(text) {
    this.setState({topic_name: text.replace("\\", "").replace("\n", "")});
  }

  finishTopicName(text) {
    console.log("finishTopicName", text)
    
    this.setState({topic_name: text.replace("\\", "").replace("\n", ""), editing: false});
    let topic = this.props.topic;
    if (this.props.isSuggestion) topic += "/__suggestions__";
    this.props.comm.send(this.props.id, {topic: topic + "/" + text});
  }
  
  clickRow(e) {
    const modKey = e.metaKey || e.shiftKey;
    if (this.props.onSelectToggle) {
      e.preventDefault();
      e.stopPropagation();
      this.props.onSelectToggle(this.props.id, e.shiftKey, e.metaKey);
    }
  }

  clickTopicName(e) {
    console.log("clickTopicName");
    const modKey = e.metaKey || e.shiftKey;
    if (this.props.onSelectToggle) {
      e.preventDefault();
      e.stopPropagation();
      this.props.onSelectToggle(this.props.id, e.shiftKey, e.metaKey);
    }
    if (!modKey && !this.state.editing) {
      this.setState({editing: true});
      console.log("topic editing", this.state.editing)
      e.preventDefault();
      e.stopPropagation();
      defer(() => this.topicNameEditable.focus());
    }
  }

  clickInput(e) {
    console.log("clickInput", e);
    const modKey = e.metaKey || e.shiftKey;
    if (this.props.onSelectToggle) {
      e.preventDefault();
      e.stopPropagation();
      this.props.onSelectToggle(this.props.id, e.shiftKey, e.metaKey);
    }
    if (!modKey && !this.state.editing) {
      this.setState({editing: true});
      console.log("value1 editing", this.state.editing)
      e.preventDefault();
      e.stopPropagation();
      defer(() => this.inputEditable.focus());
    }
  }

  

  clickOutput(e) {
    console.log("clickOutput");
    const modKey = e.metaKey || e.shiftKey;
    if (this.props.onSelectToggle) {
      e.preventDefault();
      e.stopPropagation();
      this.props.onSelectToggle(this.props.id, e.shiftKey, e.metaKey);
    }
    if (!modKey && !this.state.editing) {
      this.setState({editing: true});
      e.preventDefault();
      e.stopPropagation();
      defer(() => this.value2Editable.focus());
    }
  }

  onDragStart(e) {

    // don't initiate a drag from inside an editiable object
    if (this.mouseDownTarget.getAttribute("contenteditable") === "true") {
      e.preventDefault();
      return false;
    }
    //console.log("drag start", e, this.mouseDownTarget.getAttribute("contenteditable") === "true")
    this.setState({dragging: true});
    e.dataTransfer.setData("id", this.props.id);
    e.dataTransfer.setData("topic_name", this.state.topic_name);
    if (this.props.onDragStart) {
      this.props.onDragStart(e, this);
    }
  }

  onDragEnd(e) {
    this.setState({dragging: false});
    if (this.props.onDragEnd) {
      this.props.onDragEnd(e, this);
    }
  }

  onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragEnter(e) {
    console.log("enter", e.target)
    e.preventDefault();
    e.stopPropagation();
    if (this.state.topic_name !== null) {
      this.setState({dropHighlighted: this.state.dropHighlighted + 1});
    }
  }

  onDragLeave(e) {
    console.log("leave", e.target)
    e.preventDefault();
    e.stopPropagation();
    if (this.state.topic_name !== null) {
      this.setState({dropHighlighted: this.state.dropHighlighted - 1});
    }
  }

  onDrop(e) {
    
    const id = e.dataTransfer.getData("id");
    const topic_name = e.dataTransfer.getData("topic_name");
    if (this.state.topic_name !== null) {
      this.setState({dropHighlighted: 0});
      if (this.props.onDrop && id !== this.props.id) {
        if (topic_name !== null && topic_name !== "null") {
          this.props.onDrop(id, {topic: this.props.topic + "/" + this.state.topic_name + "/" + topic_name});
        } else {
          this.props.onDrop(id, {topic: this.props.topic + "/" + this.state.topic_name});
        }
      }
    }
  }

  addToCurrentTopic(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("addToCurrentTopic X", this.props.topic, this.state.topic_name);
    if (this.state.topic_name !== null) {
      this.props.comm.send(this.props.id, {topic: this.props.topic + "/" + this.state.topic_name});
    } else {
      this.props.comm.send(this.props.id, {topic: this.props.topic});
    }
  }
}


// https://stackoverflow.com/questions/45408920/plain-javascript-scrollintoview-inside-div
function scrollParentToChild(parent, child) {
  console.log("scrollParentToChild", parent, child)
  // Where is the parent on page
  var parentRect = parent.getBoundingClientRect();
  let parentScrolls = (parent.scrollHeight - parent.clientHeight) > 0;

  // What can you see?
  var parentViewableArea = {
    height: parent.clientHeight,
    width: parent.clientWidth
  };

  const margin = 50;

  // Where is the child
  var childRect = child.getBoundingClientRect();
  // Is the child viewable?
  if (parentScrolls) {
    var isViewable = (childRect.top > margin) && (childRect.bottom + margin <= parentRect.top + parentViewableArea.height);
  } else {
    var isViewable = (childRect.top > margin) && (childRect.bottom + margin <= parentViewableArea.height);
  }
  

  // if you can't see the child try to scroll parent
  if (!isViewable) {
        // Should we scroll using top or bottom? Find the smaller ABS adjustment
        if (parentScrolls) {
          var scrollTop = childRect.top - parentRect.top;
          var scrollBot = childRect.bottom - parentViewableArea.height - parentRect.top;
        } else {
          var scrollTop = childRect.top;
          var scrollBot = childRect.bottom - parentViewableArea.height;
        }
        if (Math.abs(scrollTop) < Math.abs(scrollBot)) {
            // we're near the top of the list
            parent.scrollTop += scrollTop - margin;
        } else {
            // we're near the bottom of the list
            parent.scrollTop += scrollBot + margin;
        }
  }

}

const score_min = -1;
const score_max = 1;
function scale_score(score) {
  return Math.max(Math.min(score, score_max), score_min) ///(score_max - score_min)
}