import Features from "./Features.js";
import zip from "lodash.zip";
import memoizeOne from "memoize-one";
import React, { Component } from "react";
import { Col, Glyphicon, Grid, Panel, Row } from "react-bootstrap";
import Token from "./Token.js";
import "./css/Visualization.css";

class Visualization extends Component {
  constructor(props) {
    super(props);
    this.findSiblings = this.findSiblings.bind(this);
    this.highlight = this.highlight.bind(this);
    this.changeAbsoluteConfidence = this.changeAbsoluteConfidence.bind(this);
    this.changeRelativeConfidence = this.changeRelativeConfidence.bind(this);
    this.changeSupport = this.changeSupport.bind(this);
    this.state = {
      highlighted: null,
      neighbours: [],
      absoluteConfidence: 0,
      relativeConfidence: props.data.rules.length,
      support: 0,
      enabledRules: []
    };
  }

  onClick(e, text) {
    console.log(e.target, text);
  }

  findSiblings(key) {
    return this.props.data.sibling_indices[
      this.props.data.labeled_indices[key]
    ];
  }

  highlight(key) {
    if (key === this.state.highlighted) {
      this.setState({
        highlighted: null,
        neighbours: []
      });
    } else {
      this.setState({
        highlighted: key,
        neighbours: this.findSiblings(key)
      });
    }
  }

  changeRelativeConfidence(e) {
    this.setState({
      relativeConfidence: e.target.value
    });
    e.preventDefault();
  }

  changeAbsoluteConfidence(e) {
    this.setState({
      absoluteConfidence: e.target.value
    });
    e.preventDefault();
  }

  changeSupport(e) {
    this.setState({
      support: e.target.value
    });
    e.preventDefault();
  }

  computeEnabledRulesSupport = memoizeOne(support => {
    const supports = this.props.data.supports;
    const enabledRules = [];
    for (let i = 0; i < this.props.data.rules.length; i++) {
      enabledRules.push(supports[i] >= support);
    }
    return enabledRules;
  });

  computeEnabledRulesAbsoluteConfidence = memoizeOne(absoluteConfidence => {
    const confidences = this.props.data.confidences;
    const enabledRules = [];
    for (let i = 0; i < this.props.data.rules.length; i++) {
      enabledRules.push(confidences[i] >= absoluteConfidence);
    }
    return enabledRules;
  });

  computeEnabledRulesRelativeConfidence = memoizeOne(relativeConfidence => {
    const rules_by_confidence = this.props.data.rules_by_confidence;
    const enabledRules = rules_by_confidence.map(_ => true);
    for (
      let i = 0;
      i < this.props.data.rules.length - relativeConfidence;
      i++
    ) {
      enabledRules[rules_by_confidence[i]] = false;
    }
    return enabledRules;
  });

  computeEnabledRules = memoizeOne(
    (relativeConfidence, absoluteConfidence, support) => {
      const data = this.props.data;
      const enabledRulesSupport = this.computeEnabledRulesSupport(support);
      const enabledRulesAbsoluteConfidence = this.computeEnabledRulesAbsoluteConfidence(
        absoluteConfidence
      );
      const enabledRulesRelativeConfidence = this.computeEnabledRulesRelativeConfidence(
        relativeConfidence
      );
      const enabledRules = [];
      for (let i = 0; i < data.rules.length; i++) {
        enabledRules.push(
          enabledRulesSupport[i] &&
            enabledRulesAbsoluteConfidence[i] &&
            enabledRulesRelativeConfidence[i]
        );
      }
      return enabledRules;
    }
  );

  computeEnabled = memoizeOne(enabledRules =>
    this.props.data.winners.map(winner => enabledRules[winner])
  );

  computeCorrects = memoizeOne(enabled => {
    const ys = this.props.data.grount_truths;
    const predictions = this.props.data.predictions;
    return enabled.map(
      (enabledi, index) => enabledi && ys[index] === predictions[index]
    );
  });

  computePrecision = memoizeOne((enabled, corrects, nEnabled) => {
    return (
      zip(enabled, corrects)
        .map(([enabledi, correct]) => enabledi && correct)
        .filter(Boolean).length / nEnabled
    );
  });

  render() {
    const data = this.props.data;
    const state = this.state;
    const neighbours = state.neighbours;
    const printables = data.class_printables;
    const winners = data.winners;
    const labeled_indices = data.labeled_indices;
    const highlighted = state.highlighted;
    const enabledRules = this.computeEnabledRules(
      state.relativeConfidence,
      state.absoluteConfidence,
      state.support
    );
    const nEnabledRules = enabledRules.filter(Boolean).length;
    const enabled = this.computeEnabled(enabledRules);
    const corrects = this.computeCorrects(enabled);
    const tokens = [];
    const nEnabled = enabled.filter(Boolean).length;
    const precision = this.computePrecision(enabled, corrects, nEnabled);
    data.vnodes.forEach((vnode, index) => {
      tokens.push(
        <Token
          key={index.toString()}
          index={index}
          highlighted={highlighted === index}
          neighbour={neighbours.includes(index)}
          correct={corrects[labeled_indices[index]]}
          value={vnode.value}
          y={vnode.y}
          enabled={vnode.y !== null && enabled[labeled_indices[index]]}
          classPrintables={printables}
          highlightCallback={this.highlight}
        />
      );
    });
    return (
      <Grid fluid={true} className="Visualization">
        <Row>
          <Col sm={12}>
            <p>Click on a token to display its features.</p>
          </Col>
        </Row>
        <Row>
          <Col sm={12}>
            <Panel bsStyle="info">
              <Panel.Heading>
                <Glyphicon glyph="info-sign" /> Statistics
              </Panel.Heading>
              <Panel.Body>
                <Row>
                  <Col sm={4}>
                    Number of selected rules: {nEnabledRules} /{" "}
                    {enabledRules.length}
                  </Col>
                  <Col sm={4}>Precision: {precision.toFixed(2)}</Col>
                  <Col sm={4}>
                    Predicted Positive Condition Rate:{" "}
                    {(nEnabled / winners.length).toFixed(2)}
                  </Col>
                </Row>
              </Panel.Body>
            </Panel>
          </Col>
        </Row>
        <Row>
          <Col sm={12}>
            <Panel bsStyle="info">
              <Panel.Heading>
                <Glyphicon glyph="cog" /> Parameters
              </Panel.Heading>
              <Panel.Body>
                <Row>
                  <Col sm={4}>
                    Relative confidence threshold:{" "}
                    <input
                      id="confidence-relative"
                      type="number"
                      onChange={this.changeRelativeConfidence}
                      value={this.state.relativeConfidence}
                      min={0}
                      max={this.props.data.rules.length}
                    />{" "}
                    / {this.props.data.rules.length}
                  </Col>
                  <Col sm={4}>
                    Absolute confidence threshold{" "}
                    <input
                      id="confidence-absolute"
                      type="number"
                      onChange={this.changeAbsoluteConfidence}
                      value={this.state.absoluteConfidence}
                      min="0.0"
                      max="100.0"
                      step="0.1"
                    />{" "}
                    / 100%
                  </Col>
                  <Col sm={4}>
                    Support threshold{" "}
                    <input
                      id="support"
                      type="number"
                      onChange={this.changeSupport}
                      value={this.state.support}
                      min={0}
                    />
                  </Col>
                </Row>
              </Panel.Body>
            </Panel>
          </Col>
        </Row>
        <Row>
          <Col sm={9}>
            <Panel bsStyle="info">
              <Panel.Heading>
                <Glyphicon glyph="align-left" /> Code
              </Panel.Heading>
              <Panel.Body>
                <div className="Code">
                  <pre>
                    <code>{tokens}</code>
                  </pre>
                </div>
              </Panel.Body>
            </Panel>
          </Col>
          <Col sm={3}>
            <Panel bsStyle="info">
              <Panel.Heading>
                <Glyphicon glyph="th-list" /> Features
              </Panel.Heading>
              <Panel.Body>
                <Features
                  features={
                    this.state.highlighted !== null
                      ? this.props.data.vnodes[this.state.highlighted]
                      : null
                  }
                  classRepresentations={this.props.data.class_representations}
                />
              </Panel.Body>
            </Panel>
          </Col>
        </Row>
        <Row>
          <Col sm={12}>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={this.props.switchHandler}
            >
              Try another input
            </button>
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default Visualization;